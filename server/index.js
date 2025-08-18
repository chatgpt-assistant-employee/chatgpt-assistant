// server/index.js (Complete, Corrected, and Final Version)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { google } = require('googleapis');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const OpenAIModule = require('openai');
const OpenAI = OpenAIModule?.default ?? OpenAIModule;
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const { toFile } = require('openai/uploads');
const postmark = require('postmark'); // <-- Import Postmark
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const avatarStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'ai_assistant_avatars', allowed_formats: ['jpg', 'png', 'jpeg'],},
});
const avatarUpload = multer({ storage: avatarStorage });


// --- INITIALIZATIONS ---
const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3001;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN);

const get = (obj, path) => path.split('.').reduce((o,k) => o?.[k], obj);

// Files
const filesCreate = (payload) => {
  const fn = get(openai, 'files.create');
  if (!fn) throw new Error('openai.files.create missing.');
  return fn.call(openai.files, payload);
};
const filesDel = async (id) => {
  const methods = [
    openai?.files?.delete,
    openai?.files?.del,
    openai?.files?.remove,
    openai?.files?.destroy,
  ].filter(Boolean);
  if (!methods.length) throw new Error('openai.files delete method missing.');
  let lastErr;
  for (const fn of methods) {
    try { return await fn.call(openai.files, id); } catch (e) { lastErr = e; }
  }
  throw lastErr;
};

// Vector Stores
const vsNS = () =>
  get(openai, 'beta.vectorStores') ?? get(openai, 'vectorStores');
const vsCreate = (payload) => {
  const ns = vsNS();
  if (!ns?.create) throw new Error('vectorStores.create missing.');
  return ns.create(payload);
};
const vsDel = (id) => {
  const ns = vsNS(); if (!ns?.del) throw new Error('vectorStores.del missing.');
  return ns.del(id);
};
const vsFilesNS = () =>
  get(openai, 'beta.vectorStores.files') ?? get(openai, 'vectorStores.files');
const vsFilesCreate = async (vsId, payload) => {
  const ns = vsFilesNS();
  if (!ns) throw new Error('vectorStores.files namespace missing.');
  // Newer SDKs: create({ vector_store_id, file_id })
  if (typeof ns.create === 'function') {
    try {
      return await ns.create({ vector_store_id: vsId, ...payload });
    } catch (e) {
      // If this SDK only supports positional, try that:
      return await ns.create(vsId, payload);
    }
  }
  throw new Error('vectorStores.files.create missing.');
};

const vsFilesDel = async (vsId, fileId) => {
  const ns = vsFilesNS();
  if (!ns) throw new Error('vectorStores.files namespace missing.');
  if (!vsId) throw new Error('vector_store_id required');
  if (!fileId) throw new Error('file_id required');

  // FIXED: Try different parameter formats based on SDK version
  if (typeof ns.delete === 'function') {
    try {
      // Try newer SDK format first (positional parameters)
      return await ns.delete(vsId, fileId);
    } catch (error) {
      // If that fails, try the object format
      if (error.message?.includes('Cannot destructure')) {
        return await ns.delete({ vector_store_id: vsId, file_id: fileId });
      }
      throw error;
    }
  }

  // Fallback methods for older SDKs
  if (typeof ns.del === 'function')     return await ns.del(vsId, fileId);
  if (typeof ns.remove === 'function')  return await ns.remove(vsId, fileId);
  if (typeof ns.destroy === 'function') return await ns.destroy(vsId, fileId);

  throw new Error('No vectorStores.files delete method found.');
};

const vsFilesList = (vsId) => {
  const ns = vsFilesNS(); if (!ns?.list) throw new Error('vectorStores.files.list missing.');
  return ns.list(vsId);
};

// Assistants
const asstNS = () => get(openai, 'beta.assistants') ?? get(openai, 'assistants');
const asstCreate = (payload) => {
  const ns = asstNS(); if (!ns?.create) throw new Error('assistants.create missing.');
  return ns.create(payload);
};
const asstRetrieve = (id) => {
  const ns = asstNS(); if (!ns?.retrieve) throw new Error('assistants.retrieve missing.');
  return ns.retrieve(id);
};
const asstDel = (id) => {
  const ns = asstNS(); if (!ns?.del) throw new Error('assistants.del missing.');
  return ns.del(id);
};

// Threads (you also use beta.threads.messages.list elsewhere)
const threadsMessagesList = (threadId) => {
  const ns = get(openai, 'beta.threads.messages') ?? get(openai, 'threads.messages');
  if (!ns?.list) throw new Error('threads.messages.list missing.');
  return ns.list(threadId);
};

// Simple per‑assistant cache: { [assistantId]: { timestamp, threads } }
const threadsCache = new Map();
const profileCache = new Map();

// Exponential‑backoff helper for 429s
async function gmailWithBackoff(fn, maxRetries = 5) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      if (status === 429 && attempt < maxRetries) {
        const ra = parseInt(err.response.headers['retry-after'], 10);
        const waitMs = ra
          ? ra * 1000
          : Math.min(2 ** attempt * 1000, 60000);
        await new Promise(r => setTimeout(r, waitMs));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}


async function getGmailClientAndPersist(assistant) {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(assistant.googleTokens);

  // Listen for any refreshed tokens and write them back
  oauth2Client.on('tokens', async (tokens) => {
    // Ensure you have the assistant's ID to update the correct record
    if (assistant && assistant.id) {
      await prisma.assistant.update({
        where: { id: assistant.id },
        data: {
          googleTokens: {
            ...assistant.googleTokens,
            ...tokens,
          },
        },
      });
    }
  })

  return google.gmail({ version: 'v1', auth: oauth2Client });
}


// --- MIDDLEWARE SETUP ---
// This MUST come BEFORE app.use(express.json())
app.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try { event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret); } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
    
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const user = await prisma.user.findUnique({ where: { stripeCustomerId: session.customer } });
            if (user) {
                const priceId = subscription.items.data[0].price.id;
                let plan = 'BASIC';
                if (priceId === process.env.PRICE_ID_GOLD) plan = 'GOLD';
                if (priceId === process.env.PRICE_ID_PLATINUM) plan = 'PLATINUM';
                const endTimestamp = subscription?.current_period_end;
                const subscriptionEndsAt = endTimestamp ? new Date(endTimestamp * 1000) : null;

                const finalAddOnSlots = user.pendingAddOnSlots ?? user.addOnSlots;

                await prisma.user.update({
                where: { id: user.id },
                data: {
                    subscriptionStatus: 'active',
                    stripeSubscriptionId: subscription.id,
                    plan,
                    basePlanLimit: 1,
                    addOnSlots: finalAddOnSlots,
                    subscriptionEndsAt
                }
                });
            }
            break;
        }
        case 'customer.subscription.updated': {
            const partial = event.data.object;
            const subscription = await stripe.subscriptions.retrieve(partial.id);

            const user = await prisma.user.findUnique({
                where: { stripeCustomerId: subscription.customer }
            });

            if (user) {
                const mainPlanItem = subscription.items.data.find(
                item => item.price.id !== process.env.PRICE_ID_ADDITIONAL_ASSISTANT
                );
                const addOnItem = subscription.items.data.find(
                item => item.price.id === process.env.PRICE_ID_ADDITIONAL_ASSISTANT
                );
                const newSlotCount = addOnItem ? addOnItem.quantity : 0;

                let plan = user.plan;
                if (mainPlanItem) {
                if (mainPlanItem.price.id === process.env.PRICE_ID_BASIC) plan = 'BASIC';
                if (mainPlanItem.price.id === process.env.PRICE_ID_GOLD) plan = 'GOLD';
                if (mainPlanItem.price.id === process.env.PRICE_ID_PLATINUM) plan = 'PLATINUM';
                }

                const newStatus = subscription.cancel_at_period_end ? 'cancelled_grace_period' : 'active';

                // ✅ FINAL FIX
                const mainItem = subscription.items.data[0];
                const subscriptionEndsAt =
                subscription.cancel_at_period_end && mainItem?.current_period_end
                    ? new Date(mainItem.current_period_end * 1000)
                    : null;

                console.log('✅ subscriptionEndsAt FIXED:', subscriptionEndsAt);

                const finalAddOnSlots = user.pendingAddOnSlots ?? user.addOnSlots;

                await prisma.user.update({
                where: { id: user.id },
                data: {
                    plan,
                    subscriptionStatus: newStatus,
                    addOnSlots: finalAddOnSlots,
                    subscriptionEndsAt,
                    pendingAddOnSlots: null
                }
                });
            }

            break;
        }
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const user = await prisma.user.findFirst({ where: { stripeSubscriptionId: subscription.id } });
            if (user) {
                const userAssistants = await prisma.assistant.findMany({ where: { userId: user.id } });
                for (const assistant of userAssistants) {
                    try { await openai.beta.assistants.del(assistant.openaiAssistantId); } catch (oaiError) { console.error(`Failed to delete OAI assistant ${assistant.openaiAssistantId}`); }
                }
                await prisma.assistant.deleteMany({ where: { userId: user.id } });
                await prisma.user.update({ where: { id: user.id }, data: { subscriptionStatus: 'inactive', plan: null, stripeSubscriptionId: null, basePlanLimit: 0, addOnSlots: 0, subscriptionEndsAt: null } });
            }
            break;
        }
    }
    res.json({received: true});
});

app.use(express.json());

app.set('trust proxy', 1);

// Simple allow test (exact FRONTEND_URL, localhost, ANY *.vercel.app)
const allowedOrigins = new Set([
  FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

function isAllowedOrigin(origin) {
  try {
    const url = new URL(origin);
    if (allowedOrigins.has(origin)) return true;
    // allow any Vercel preview/prod
    if (url.hostname.endsWith('.vercel.app') && url.protocol === 'https:') return true;
    return false;
  } catch {
    return false;
  }
}

// CORS middleware that works with credentials
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); // must echo, not '*'
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ✅ Express-5 safe preflight handler (no path pattern)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // mirror CORS headers so browsers are happy
    const origin = req.headers.origin;
    if (!origin || allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin || '*');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    }
    return res.sendStatus(204);
  }
  next();
});

app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || 'a_very_secret_key_for_sessions_replace_this_for_production',
    resave: false,
    saveUninitialized: false, // Set to false for production
    cookie: { 
        secure: true, // Must be true since sameSite is 'none'
        sameSite: 'none', // This is the key setting for cross-domain cookies
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // e.g., 7 days
    },
}));

// --- HELPER FUNCTIONS ---
const createOAuth2Client = () => new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.APP_URL}/auth/google/callback`
);
const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.profile',
];

// This is a new middleware to protect routes from unverified users
const isVerified = async (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user.isVerified) {
        return res.status(403).json({ message: 'Please verify your email address to continue.' });
    }
    next();
};

// === GLOBAL HELPER FUNCTIONS (FIX) ===
const cleanText = (text) => {
    const lines = text.split('\n');
    const junkPatterns = ['unsubscribe', 'view in browser', 'update your preferences', 'no longer wish to receive', 'all rights reserved', 'upvotes', 'comments', 'hide r/', 'view more posts', 'this email was intended for', 'san francisco, ca'];
    const cleanLines = lines.filter(line => {
        const lowerLine = line.toLowerCase();
        return !junkPatterns.some(pattern => lowerLine.includes(pattern));
    });
    let cleanedText = cleanLines.join('\n');
    cleanedText = cleanedText.replace(/(&#\d+;|\s*&zwnj;&nbsp;)+/g, ' ').replace(/Read More/gi, '').replace(/•/g, '');
    return cleanedText.replace(/(\n\s*){3,}/g, '\n\n').trim();
};

const getBody = (payload) => {
    let body = { plain: '', html: '' };
    const findParts = (parts) => {
        for (let part of parts) {
            if (part.mimeType === 'text/plain' && part.body.data) { body.plain += Buffer.from(part.body.data, 'base64').toString('utf8'); }
            else if (part.mimeType === 'text/html' && part.body.data) { body.html += Buffer.from(part.body.data, 'base64').toString('utf8'); }
            else if (part.parts) { findParts(part.parts); }
        }
    };
    if (payload.parts) { findParts(payload.parts); }
    else if (payload.body && payload.body.data) {
        if (payload.mimeType === 'text/plain') { body.plain = Buffer.from(payload.body.data, 'base64').toString('utf8'); }
        else if (payload.mimeType === 'text/html') { body.html = Buffer.from(payload.body.data, 'base64').toString('utf8'); }
    }
    if (body.plain) return cleanText(body.plain);
    if (body.html) return cleanText(body.html.replace(/<style[^>]*>.*<\/style>/gis, '').replace(/<script[^>]*>.*<\/script>/gis, '').replace(/<[^>]*>/g, ''));
    return '';
};

const parseEmail = (header) => {
    if (!header) return '';
    const bracketMatch = header.match(/<(.+?)>/);
    if (bracketMatch && bracketMatch[1]) return bracketMatch[1];
    const emailMatch = header.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6})/);
    if (emailMatch && emailMatch[1]) return emailMatch[1];
    return header;
};

// --- AUTOMATED FOLLOW-UP WORKER ---
async function checkAndSendFollowUps() {
    console.log(`[${new Date().toISOString()}]  cron: Running follow-up check...`);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find all sent emails older than 24 hours that still need a follow-up
    const emailsToFollowUp = await prisma.emailLog.findMany({
        where: {
            action: 'REPLY_SENT',
            followUpRequired: true,
            followUpSent: false,
            createdAt: { lt: twentyFourHoursAgo },
        },
        include: { assistant: true },
    });

    if (emailsToFollowUp.length === 0) {
        console.log(`[cron] No emails require a follow-up.`);
        return;
    }

    console.log(`[cron] Found ${emailsToFollowUp.length} emails needing a follow-up.`);

    for (const log of emailsToFollowUp) {
        try {
            // Here, you would implement the full logic to:
            // 1. Fetch the full Gmail thread using the log.threadId
            // 2. Send the conversation to the AI with a "polite follow-up" prompt
            // 3. Send the new email

            console.log(`[cron] SIMULATING follow-up for log ID: ${log.id}`);

            // Mark this log as handled so we never send a follow-up for it again
            await prisma.emailLog.update({
                where: { id: log.id },
                data: { followUpSent: true },
            });
        } catch (error) {
            console.error(`[cron] Failed to send follow-up for log ${log.id}:`, error);
        }
    }
}

// Schedule the worker to run every 30 minutes
cron.schedule('*/60 * * * *', checkAndSendFollowUps);

// --- ROUTES ---

// USER AUTH & SESSION ROUTES
app.get('/api/session', (req, res) => {
    if (req.session.userId) {
        res.status(200).json({ userId: req.session.userId });
    } else {
        res.status(401).json({ message: 'Not authenticated' });
    }
});

app.get('/api/debug-user', async (req, res) => {
  const user = await prisma.user.findFirst();
  res.json({ subscriptionEndsAt: user.subscriptionEndsAt });
});

app.post('/auth/register', async (req, res) => {
    try {
        const { email, password, planIdentifier } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists." });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        const user = await prisma.user.create({
            data: { email, passwordHash, verificationToken },
        });

       // ✅ ALWAYS email the verification link (even if they picked a plan)
        const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;
        try {
            await postmarkClient.sendEmail({
            From: 'support@chatgptassistants.com',
            To: user.email,
            Subject: 'Verify Your Account for AI Gmail Assistant',
            HtmlBody: `<p>Please verify your email:</p><a href="${verificationUrl}">Verify My Email</a>`,
            TextBody: `Verify your email: ${verificationUrl}`,
            MessageStream: 'outbound',
            });
            console.log('Postmark verification sent to', user.email);
        } catch (e) {
            console.error('Postmark send failed:', e);
            // don't throw; still let the flow continue (user can use “Resend”)
        }

            // If a plan was selected, create a checkout session immediately
            if (planIdentifier) {
            const priceIdMap = {
                basic: process.env.PRICE_ID_BASIC,
                gold: process.env.PRICE_ID_GOLD,
                platinum: process.env.PRICE_ID_PLATINUM,
            };
            const priceId = priceIdMap[planIdentifier];
            if (!priceId) return res.status(400).json({ message: 'Invalid plan selected during registration.' });

            const customer = await stripe.customers.create({ email: user.email, name: user.name });
            await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });

            const session = await stripe.checkout.sessions.create({
                customer: customer.id,
                payment_method_types: ['card'],
                line_items: [{ price: priceId, quantity: 1 }],
                mode: 'subscription',
                success_url: `${FRONTEND_URL}/payment-success`,
                cancel_url: `${FRONTEND_URL}/billing?cancelled=true`,
            });

            // log them in so they can hit /auth/resend-verification if needed
            req.session.userId = user.id;
            return res.json({ checkoutUrl: session.url });
            }

            // No plan chosen — normal path
            return res.status(201).json({ message: 'Registration successful! Please check your email to verify your account.' });
        } catch (error) {
            console.error('Registration Error:', error);
            res.status(500).json({ message: 'Error registering user.' });
        }
});

app.post('/auth/resend-verification', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (user.isVerified) return res.status(400).json({ message: 'Already verified' });

  const verificationToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({ where: { id: user.id }, data: { verificationToken } });

  const verificationUrl = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

  try {
    await postmarkClient.sendEmail({
      From: 'support@chatgptassistants.com',
      To: user.email,
      Subject: 'Verify your email',
      HtmlBody: `Click <a href="${verificationUrl}">here</a> to verify your account.`,
      TextBody: `Open this link to verify: ${verificationUrl}`,
      MessageStream: 'outbound',
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Resend failed:', e);
    res.status(500).json({ message: 'Failed to send verification email' });
  }
});

// === NEW VERIFICATION ROUTE ===
app.post('/auth/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        const user = await prisma.user.findUnique({ where: { verificationToken: token } });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired verification token.' });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true, verificationToken: null }, // Verify user and clear token
        });
        
        // Log the user in after successful verification
        req.session.userId = user.id;
        res.json({ message: 'Email verified successfully! You are now logged in.' });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying email.' });
    }
});

app.post('/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });

        // IMPORTANT: Always send a success-like response, even if the user is not found.
        // This prevents "user enumeration" attacks.
        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            const passwordResetExpiry = new Date(Date.now() + 3600000); // 1 hour from now

            await prisma.user.update({
                where: { email },
                data: { passwordResetToken, passwordResetExpiry },
            });

            // Send the reset email via Postmark
            const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
            await postmarkClient.sendEmail({
                "From": "support@chatgptassistants.com",
                "To": user.email,
                "Subject": "Reset Your Password",
                "HtmlBody": `<p>You requested a password reset. Please click this link to set a new password:</p><a href="${resetUrl}">Reset Password</a><p>This link will expire in one hour.</p>`,
                "TextBody": `You requested a password reset. Please copy and paste this URL into your browser: ${resetUrl}`,
                "MessageStream": "outbound"
            });
        }
        res.json({ message: "If an account with that email exists, a password reset link has been sent." });
    } catch (error) {
        // Log the error, but don't expose details to the client
        console.error("Forgot Password Error:", error);
        res.status(500).json({ message: "An error occurred." });
    }
});

// Route to handle the actual password update
app.post('/auth/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        const passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findUnique({ where: { passwordResetToken } });
        
        if (!user || user.passwordResetExpiry < new Date()) {
            return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
        }

        const newPasswordHash = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
                passwordResetToken: null,
                passwordResetExpiry: null,
            },
        });

        res.json({ message: 'Password has been reset successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting password.' });
    }
});


app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ message: "Invalid credentials." });
        }
        req.session.userId = user.id;
        res.json({ message: "Login successful!", userId: user.id });
    } catch (error) {
        res.status(500).json({ message: "Error logging in.", error: error.message });
    }
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ message: 'Logged out' });
    });
});

app.post('/api/create-checkout-session', isVerified, async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        // The frontend now sends a plan identifier like "basic", "gold", etc.
        const { planIdentifier } = req.body;
        
        // --- THIS IS THE NEW LOGIC ---
        // The backend looks up the correct Price ID from its .env file
        const priceIdMap = {
            basic: process.env.PRICE_ID_BASIC,
            gold: process.env.PRICE_ID_GOLD,
            platinum: process.env.PRICE_ID_PLATINUM,
        };

        const priceId = priceIdMap[planIdentifier];

        if (!priceId) {
            console.error(`Invalid planIdentifier received: ${planIdentifier}`);
            return res.status(400).json({ message: 'Invalid plan selected.' });
        }
        // --- END OF NEW LOGIC ---

        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
        let stripeCustomerId = user.stripeCustomerId;

        if (!stripeCustomerId) {
            const customer = await stripe.customers.create({ email: user.email, name: user.name });
            stripeCustomerId = customer.id;
            await prisma.user.update({ where: { id: req.session.userId }, data: { stripeCustomerId } });
        }

        const session = await stripe.checkout.sessions.create({
            customer: stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'subscription',
            success_url: `${FRONTEND_URL}/payment-success`,
            cancel_url: `${FRONTEND_URL}/billing?cancelled=true`,
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error("Error creating Stripe checkout session:", error);
        res.status(500).json({ message: 'Failed to create checkout session.' });
    }
});

app.post('/api/change-plan', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const { newPlanIdentifier } = req.body;
    if (!newPlanIdentifier) return res.status(400).json({ message: 'No plan identifier provided.' });

    const normalized = newPlanIdentifier.toLowerCase();

    // Price mapping (ensure these env vars exist)
    const priceIdMap = {
      basic: process.env.PRICE_ID_BASIC,
      gold: process.env.PRICE_ID_GOLD,
      platinum: process.env.PRICE_ID_PLATINUM,
    };

    // Adjust these to reflect the true base limits of each plan
    const basePlanLimitMap = {
      basic: 1,
      gold: 1,
      platinum: 1,
    };

    const newPriceId = priceIdMap[normalized];
    if (!newPriceId) return res.status(400).json({ message: 'Invalid plan identifier.' });

    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user || !user.stripeSubscriptionId) {
      return res.status(403).json({ message: 'No active subscription to change.' });
    }

    // Fetch current subscription + items (expand the necessary price info)
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
      expand: ['items.data.price'],
    });

    const additionalAssistantPriceId = process.env.PRICE_ID_ADDITIONAL_ASSISTANT;

    // Identify the main plan item (exclude assistant add-on)
    const planItem = subscription.items.data.find(
      item => item.price.id !== additionalAssistantPriceId
    );
    if (!planItem) {
      return res.status(500).json({ message: 'Main plan item not found.' });
    }

    const currentPrice = planItem.price; // expanded price object
    const newPrice = await stripe.prices.retrieve(newPriceId);

    const currentAmount = currentPrice.unit_amount ?? 0;
    const newAmount = newPrice.unit_amount ?? 0;

    // === UPGRADE: more expensive plan ===
    if (newAmount > currentAmount) {
      await stripe.subscriptionItems.update(planItem.id, {
        price: newPriceId,
        proration_behavior: 'always_invoice', // immediate prorated charge
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          plan: normalized.toUpperCase(),
          basePlanLimit: basePlanLimitMap[normalized] ?? user.basePlanLimit,
          pendingPlan: null, // clear any scheduled downgrade
        },
      });

      return res.json({ message: 'Upgraded plan immediately with prorated charge.' });
    }

    // === DOWNGRADE: cheaper plan (schedule, no immediate change) ===
    if (newAmount < currentAmount) {
  // === DOWNGRADE: schedule, no immediate change ===
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pendingPlan: normalized,
    },
  });

  // Determine when the downgrade will take effect:
  let effectiveAt = null;

  // Try to get a subscription object that has current_period_end
  let subForPeriodEnd = subscription;
  if (!subForPeriodEnd.current_period_end) {
    try {
      const fresh = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
        expand: ['items.data.price'],
      });
      if (fresh.current_period_end) {
        subForPeriodEnd = fresh;
      }
    } catch (fetchErr) {
      console.warn('Failed to re-fetch subscription for period end fallback:', fetchErr);
    }
  }

  if (subForPeriodEnd.current_period_end) {
    effectiveAt = new Date(subForPeriodEnd.current_period_end * 1000).toISOString();
  } else {
    // Log missing period end only once per subscription to avoid spam
    if (!global.__loggedMissingPeriodEnd) global.__loggedMissingPeriodEnd = new Set();
    if (!global.__loggedMissingPeriodEnd.has(user.stripeSubscriptionId)) {
      
      global.__loggedMissingPeriodEnd.add(user.stripeSubscriptionId);
    }

    // Fallback: compute from billing_cycle_anchor + interval
    if (subscription.billing_cycle_anchor) {
      let dt = new Date(subscription.billing_cycle_anchor * 1000);
      let interval = null;
      let intervalCount = 1;

      if (subscription.plan) {
        interval = subscription.plan.interval;
        intervalCount = subscription.plan.interval_count || 1;
      } else if (
        subscription.items &&
        Array.isArray(subscription.items.data) &&
        subscription.items.data[0] &&
        subscription.items.data[0].price &&
        subscription.items.data[0].price.recurring
      ) {
        interval = subscription.items.data[0].price.recurring.interval;
        intervalCount =
          subscription.items.data[0].price.recurring.interval_count || 1;
      }

      if (interval === 'month') {
        dt.setMonth(dt.getMonth() + intervalCount);
      } else if (interval === 'year') {
        dt.setFullYear(dt.getFullYear() + intervalCount);
      } else if (interval === 'week') {
        dt = new Date(dt.getTime() + 7 * 24 * 60 * 60 * 1000 * intervalCount);
      } else if (interval === 'day') {
        dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000 * intervalCount);
      } else {
        dt.setMonth(dt.getMonth() + 1); // last-resort month
      }

      effectiveAt = dt.toISOString();
    }
  }

  const responsePayload = {
    message: `Downgrade to ${normalized} scheduled; it will take effect${
      effectiveAt ? ` on ${effectiveAt}` : ' at the end of your current billing period'
    }.`,
    pendingPlan: normalized,
  };
  if (effectiveAt) responsePayload.effectiveAt = effectiveAt;

  return res.json(responsePayload);
}

    // === Same tier / no change ===
    await prisma.user.update({
      where: { id: user.id },
      data: {
        plan: normalized.toUpperCase(),
        basePlanLimit: basePlanLimitMap[normalized] ?? user.basePlanLimit,
        pendingPlan: null,
      },
    });

    return res.json({ message: 'Plan is already that tier; no change applied.' });
  } catch (err) {
    console.error('Error changing plan:', err);
    res.status(500).json({ message: 'Failed to change plan.' });
  }
});

// This route creates a link to the Stripe Customer Portal
app.post('/api/create-portal-session', isVerified, async (req, res) => {
    console.log('--- DIAGNOSTIC: /api/create-portal-session route hit ---');
    if (!req.session.userId) {
        console.log('DIAGNOSTIC: FAILED - No session user ID.');
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        console.log('DIAGNOSTIC: Finding user with ID:', req.session.userId);
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

        if (!user) {
            console.log('DIAGNOSTIC: FAILED - User not found in database.');
            return res.status(404).json({ message: 'User not found.' });
        }

        console.log('DIAGNOSTIC: User found:', user.email);

        if (!user.stripeCustomerId) {
            console.log('DIAGNOSTIC: FAILED - User does not have a Stripe Customer ID.');
            return res.status(400).json({ message: 'Stripe customer ID not found for this user.' });
        }

        console.log('DIAGNOSTIC: Found Stripe Customer ID:', user.stripeCustomerId);
        console.log('DIAGNOSTIC: Creating Stripe Billing Portal session...');

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: `${FRONTEND_URL}/billing`,
        });
        
        console.log('DIAGNOSTIC: Successfully created portal session. URL:', portalSession.url);
        res.json({ url: portalSession.url });

    } catch (error) {
        console.error('--- DIAGNOSTIC: CRITICAL ERROR in /api/create-portal-session ---', error);
        res.status(500).json({ message: 'Failed to create portal session.', error: error.message });
    }
});

// === NEW AUTOMATION LOGIC ===

// This function starts "watching" an assistant's inbox
async function startWatchingInbox(assistantId) {
    const assistant = await prisma.assistant.findUnique({ where: { id: assistantId } });
    if (!assistant || !assistant.googleTokens) {
        console.log(`Cannot watch inbox for assistant ${assistantId}: No Google tokens.`);
        return;
    }
    
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(assistant.googleTokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    try {
        const response = await gmail.users.watch({
            userId: 'me',
            requestBody: {
                labelIds: ['INBOX'],
                topicName: 'projects/gmail-assistant-465917/topics/gmail-updates', // <-- IMPORTANT: Replace these
            }
        });

        await prisma.assistant.update({
            where: { id: assistantId },
            data: {
                googleHistoryId: response.data.historyId,
                googleChannelId: response.data.channelId, // You might need to store this for stopping
                googleChannelExpiry: new Date(Number(response.data.expiration)),
            }
        });
        console.log(`Successfully started watching inbox for assistant ${assistantId}. Expiration: ${new Date(Number(response.data.expiration))}`);
    } catch (error) {
        console.error(`Failed to start watching inbox for assistant ${assistantId}:`, error);
    }
}

// This is the endpoint that Google's Pub/Sub service will send notifications to
app.post('/google-push-notification', express.json(), async (req, res) => {
    try {
        res.status(204).send();
        const data = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString('utf8'));
        const { emailAddress } = data;
        const assistant = await prisma.assistant.findFirst({ where: { emailAddress } });
        if (!assistant || !assistant.googleTokens) return;

        const gmail = await getGmailClientAndPersist(assistant);

        const historyResponse = await gmail.users.history.list({ 
            userId: 'me', 
            startHistoryId: assistant.googleHistoryId 
        });
        
        const newHistoryId = historyResponse.data.historyId;
        const changes = historyResponse.data.history;
        
        if (!changes || changes.length === 0) {
            if (newHistoryId) {
                await prisma.assistant.update({ 
                    where: { id: assistant.id }, 
                    data: { googleHistoryId: newHistoryId.toString() } 
                });
            }
            return;
        }
        
        const addedMessages = changes.flatMap(change => change.messagesAdded || []);
        if (addedMessages.length === 0) {
            if (newHistoryId) {
                await prisma.assistant.update({ 
                    where: { id: assistant.id }, 
                    data: { googleHistoryId: newHistoryId.toString() } 
                });
            }
            return;
        }

        const firstAddedMessage = addedMessages[0].message;
        const threadId = firstAddedMessage.threadId;

        // --- THIS IS THE NEW LOGIC TO CANCEL FOLLOW-UPS ---
        console.log(`[automation] New message in thread ${threadId}. Cancelling any pending follow-ups.`);
        await prisma.emailLog.updateMany({
            where: {
                threadId: threadId,
                assistantId: assistant.id,
            },
            data: {
                followUpRequired: false, // Cancel the follow-up
            },
        });
        // --- END OF NEW LOGIC ---
        
        const fullThread = await gmail.users.threads.get({ userId: 'me', id: threadId });
        const lastMessage = fullThread.data.messages.slice(-1)[0];
        const fromHeader = lastMessage.payload.headers.find(h => h.name === 'From')?.value || '';
        
        // Skip if the message is from the assistant itself
        if (fromHeader.includes(assistant.emailAddress)) {
            if (newHistoryId) {
                await prisma.assistant.update({ 
                    where: { id: assistant.id }, 
                    data: { googleHistoryId: newHistoryId.toString() } 
                });
            }
            return;
        }
        
        const emailBody = getBody(lastMessage.payload);

        const triagePrompt = `
You are an expert email classification system. Your task is to classify the content of a new email into one of three distinct categories. Respond with ONLY the category label.

Here are the categories and their definitions:
1.  **Direct Inquiry**: Any message from a person that requires a unique, contextual response. This includes questions, replies, business proposals, and casual conversation.
2.  **Form Submission**: An email that is automatically generated by a web form, lead capture form, or application system. It typically contains structured data with labels like "Name:", "Email:", "Message:".
3.  **Advertisement**: Automated marketing emails, newsletters, promotions, social media notifications (like from Reddit), or spam. These do not require a personal reply.

**Examples:**
-   **Text:** "wow bro thats cool. what else can you help me with"
    **Classification:** Direct Inquiry
-   **Text:** "Full/Company Name: GBD trans, E-mail: gbdtransllc@gmail.com, Phone Number: 7748238913..."
    **Classification:** Form Submission
-   **Text:** "r/nvidia: 5090 Upgrade Upgraded to 5090 Read More 94 upvotes"
    **Classification:** Advertisement

Now, classify the following email text. Respond with only one of the three category labels.

EMAIL TEXT: """
${emailBody.substring(0, 4000)}
"""

CLASSIFICATION:`;

        const completion = await openai.chat.completions.create({ 
            model: 'gpt-4o', 
            messages: [{ role: 'user', content: triagePrompt }] 
        });
        const classification = completion.choices[0].message.content.trim();

        console.log(`\n🤖 NEW EMAIL for ${assistant.name} | Triage Result: [ ${classification} ]\n`);
        
        if (classification.toLowerCase().includes('advertisement')) {
            console.log("Action: Email classified as junk. No reply will be sent.");
        } else {
            console.log(`Action: Proceeding with reply for thread ${threadId}...`);
            
            const conversationText = fullThread.data.messages.map(m => 
                `From: ${m.payload.headers.find(h => h.name === 'From')?.value}\n\n${getBody(m.payload)}`
            ).join('\n\n---\n\n');
            
            const replyRun = await openai.beta.threads.runs.createAndPoll(
                (await openai.beta.threads.create({ messages: [{ role: 'user', content: conversationText }] })).id, 
                { assistant_id: assistant.openaiAssistantId }
            );
            
            if (replyRun.status === 'completed') {
                const messages = await openai.beta.threads.messages.list(replyRun.thread_id);
                const replyText = messages.data[0].content[0].text.value;
                
                // Get thread details for proper threading
                const subject = lastMessage.payload.headers.find(h => h.name === 'Subject')?.value || '';
                const fromHeader = lastMessage.payload.headers.find(h => h.name === 'From')?.value || '';
                const finalRecipient = parseEmail(fromHeader);
                
                // ✅ FIXED: Get ALL Message-IDs from the thread for proper threading
                const allMessageIds = fullThread.data.messages.map(msg => 
                    msg.payload.headers.find(h => h.name.toLowerCase() === 'message-id')?.value
                ).filter(Boolean);
                
                const lastMessageId = allMessageIds[allMessageIds.length - 1];
                const referencesHeader = allMessageIds.slice(0, -1).join(' '); // All except the last one
                
                if (!lastMessageId) {
                    console.error('❌ No Message-ID found for threading');
                    return;
                }
                
                // Create email log for tracking
                const newLog = await prisma.emailLog.create({ 
                    data: { 
                        action: 'REPLY_SENT', 
                        status: 'sent', 
                        recipientEmail: finalRecipient, 
                        assistantId: assistant.id,
                        threadId: threadId // Store Gmail thread ID
                    } 
                });
                
                const htmlBody = `<p>${replyText.replace(/\n/g, '<br>')}</p><img src="http://localhost:3001/track/open/${newLog.id}" width="1" height="1" alt="">`;
                
                // ✅ FIXED: Proper email threading with correct headers
                const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const rawMessageParts = [
                    `From: ${assistant.emailAddress}`,
                    `To: ${finalRecipient}`,
                    `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
                    `In-Reply-To: ${lastMessageId}`,
                    `References: ${referencesHeader} ${lastMessageId}`.trim(),
                    'MIME-Version: 1.0',
                    `Content-Type: multipart/alternative; boundary="${boundary}"`,
                    '',
                    `--${boundary}`,
                    'Content-Type: text/plain; charset="UTF-8"',
                    '',
                    replyText,
                    '',
                    `--${boundary}`,
                    'Content-Type: text/html; charset="UTF-8"',
                    '',
                    htmlBody,
                    '',
                    `--${boundary}--`
                ];

                const rawMessage = rawMessageParts.join('\r\n');
                const encodedMessage = Buffer.from(rawMessage).toString('base64url');
                
                // ✅ CRITICAL: Send with threadId to keep in same conversation
                const sentMessage = await gmail.users.messages.send({ 
                    userId: 'me', 
                    requestBody: { 
                        raw: encodedMessage,
                        threadId: threadId // This ensures threading!
                    } 
                });
                
                await prisma.emailLog.update({ 
                    where: { id: newLog.id }, 
                    data: { gmailMessageId: sentMessage.data.id } 
                });
                
                // Start monitoring for email opens
                try {
                    await scheduleEmailMonitoring(assistant.id, threadId, newLog.id);
                } catch (monitorErr) {
                    console.error('❌ scheduleEmailMonitoring error:', monitorErr);
                }
                
                console.log(`✅ AUTOMATION SUCCESS: Reply sent for thread ${threadId}`);
            } else {
                console.error(`Automation Error: AI Run failed for thread ${threadId} with status: ${replyRun.status}`);
            }
        }
        
        if (newHistoryId) {
            await prisma.assistant.update({ 
                where: { id: assistant.id }, 
                data: { googleHistoryId: newHistoryId.toString() } 
            });
        }
    } catch (error) { 
        console.error("Error processing Google push notification:", error); 
    }
});

app.get('/api/billing-details', isVerified, async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
        
        if (!user || !user.stripeCustomerId || !user.stripeSubscriptionId) {
            return res.status(404).json({ message: 'No active subscription found.' });
        }

        // Fetch subscription, customer, and recent invoices from Stripe
        const [subscription, customer, invoices] = await Promise.all([
            stripe.subscriptions.retrieve(user.stripeSubscriptionId),
            stripe.customers.retrieve(user.stripeCustomerId),
            stripe.invoices.list({
                customer: user.stripeCustomerId,
                limit: 12, // Get last 12 invoices
            })
        ]);

        // Get the payment method details
        const paymentMethodId = subscription.default_payment_method;
        let paymentMethodDetails = null;
        if (paymentMethodId) {
            const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
            paymentMethodDetails = {
                brand: pm.card.brand.toUpperCase(),
                last4: pm.card.last4,
                exp_month: pm.card.exp_month.toString().padStart(2, '0'),
                exp_year: pm.card.exp_year.toString(),
            };
        }

        // Process billing history from Stripe invoices
        const billingHistory = invoices.data
            .filter(invoice => invoice.status === 'paid')
            .map(invoice => ({
                id: invoice.id,
                date: new Date(invoice.created * 1000).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                amount: (invoice.amount_paid / 100).toFixed(2), // Stripe amounts are in cents
                status: 'paid',
                invoiceUrl: invoice.hosted_invoice_url
            }));

        // Calculate total spent this year
        const thisYear = new Date().getFullYear();
        const thisYearInvoices = invoices.data.filter(invoice => {
            const invoiceYear = new Date(invoice.created * 1000).getFullYear();
            return invoiceYear === thisYear && invoice.status === 'paid';
        });
        const totalSpent = thisYearInvoices.reduce((sum, invoice) => {
            return sum + (invoice.amount_paid / 100);
        }, 0);

        // Get subscription start date
        const subscriptionStart = new Date(subscription.created * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const mainItem = subscription.items?.data?.[0];
        const renewalDate = mainItem?.current_period_end
        ? new Date(mainItem.current_period_end * 1000)
        : null;

        const totalAssistantLimit = user.basePlanLimit + user.addOnSlots;

        const details = {
            plan: user.plan,
            status: user.subscriptionStatus,
            renewalDate: renewalDate,
            assistantCount: await prisma.assistant.count({ where: { userId: user.id } }),
            basePlanLimit: user.basePlanLimit,
            addOnSlots: user.addOnSlots,
            assistantLimit: totalAssistantLimit,
            paymentMethod: paymentMethodDetails,
            billingHistory: billingHistory,
            subscriptionStart: subscriptionStart,
            totalSpent: totalSpent.toFixed(2),
            // Additional useful info
            subscriptionId: subscription.id,
            customerId: user.stripeCustomerId,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            pendingAddOnSlots: user.pendingAddOnSlots,
            subscriptionEndsAt: user.subscriptionEndsAt,
            pendingPlan: user.pendingPlan
        };

        res.json(details);

    } catch (error) {
        console.error("Error fetching billing details:", error);
        res.status(500).json({ 
            message: "Failed to fetch billing details.", 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

app.post('/api/purchase-assistant', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user || !user.stripeSubscriptionId) {
      return res.status(403).json({ message: 'User is not subscribed.' });
    }

    const additionalAssistantPriceId = process.env.PRICE_ID_ADDITIONAL_ASSISTANT;

    // 1. Retrieve current subscription
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    // 2. Find existing add-on item
    const existingItem = subscription.items.data.find(
      item => item.price.id === additionalAssistantPriceId
    );

    // 3. Increment or create
    if (existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: existingItem.quantity + 1,
        proration_behavior: 'always_invoice',
      });
    } else {
      await stripe.subscriptionItems.create({
        subscription: user.stripeSubscriptionId,
        price: additionalAssistantPriceId,
        quantity: 1,
        proration_behavior: 'always_invoice',
      });
    }

    // 4. Re-fetch updated subscription and sync addOnSlots from Stripe
    const updatedSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const updatedAddOnItem = updatedSubscription.items.data.find(
      item => item.price.id === additionalAssistantPriceId
    );
    const newAddOnSlots = updatedAddOnItem ? updatedAddOnItem.quantity : 0;

    await prisma.user.update({
      where: { id: req.session.userId },
      data: {
        addOnSlots: newAddOnSlots,
        pendingAddOnSlots: null,
      },
    });

    res.json({
      message: 'Assistant slot purchased successfully.',
      addOnSlots: newAddOnSlots,
    });
  } catch (error) {
    console.error('Error purchasing additional assistant:', error);
    res.status(500).json({ message: 'Failed to purchase assistant.' });
  }
});

app.post('/api/remove-assistant-subscription', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { assistantIdToDelete } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
        if (!user || !user.stripeSubscriptionId) return res.status(403).json({ message: 'User is not subscribed.' });

        // Find the subscription item for the add-on assistants
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const existingItem = subscription.items.data.find(
            item => item.price.id === process.env.PRICE_ID_ADDITIONAL_ASSISTANT
        );

        if (!existingItem || existingItem.quantity < 1) {
            return res.status(400).json({ message: 'No add-on assistants to remove.' });
        }

        // Decrease the quantity by 1. Use proration_behavior: 'none' so they are not credited immediately.
        await stripe.subscriptionItems.update(existingItem.id, {
            quantity: existingItem.quantity - 1,
            proration_behavior: 'none',
        });

        // Now, delete the actual assistant from OpenAI and our database
        const assistant = await prisma.assistant.findUnique({ where: { id: assistantIdToDelete } });
        if (assistant && assistant.userId === req.session.userId) {
            await openai.beta.assistants.del(assistant.openaiAssistantId);
            await prisma.assistant.delete({ where: { id: assistantIdToDelete } });
        }
        const updatedSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const addOnItem = updatedSubscription.items.data.find(item => item.price.id === process.env.PRICE_ID_ADDITIONAL_ASSISTANT);
        const newAddOnSlots = addOnItem ? addOnItem.quantity : 0;
        
        // Finally, decrement the user's limit in our database
        await prisma.user.update({
            where: { id: req.session.userId },
            data: {
                addOnSlots: newAddOnSlots,
            },
        });

        res.json({ message: 'Assistant removed and subscription updated.' });
    } catch (error) {
        console.error("Error removing assistant subscription:", error);
        res.status(500).json({ message: 'Failed to remove assistant.' });
    }
});

app.get('/api/proration-preview', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
        if (!user || !user.stripeSubscriptionId) {
            return res.status(403).json({ message: 'User is not subscribed.' });
        }
        
        const additionalAssistantPriceId = process.env.PRICE_ID_ADDITIONAL_ASSISTANT;
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        
        
        const currentItems = subscription.items.data.map(item => ({
            id: item.id,
            price: item.price.id,
            quantity: item.quantity,
        }));

        const additionalAssistantItem = currentItems.find(
            item => item.price === additionalAssistantPriceId
        );

        if (additionalAssistantItem) {
            additionalAssistantItem.quantity += 1;
        } else {
            currentItems.push({
                price: additionalAssistantPriceId,
                quantity: 1,
            });
        }
        
        console.log('Updated items for preview:', currentItems);
        
        // Create preview invoice
        const invoice = await stripe.invoices.createPreview({
            customer: user.stripeCustomerId,
            subscription: user.stripeSubscriptionId,
            subscription_details: {
                items: currentItems,
                proration_behavior: 'always_invoice'
            }
        });

        
        invoice.lines.data.forEach((line, index) => {
            console.log(`Line ${index}:`, {
                amount: line.amount,
                proration: line.proration,
                description: line.description,
                period_start: new Date(line.period.start * 1000),
                period_end: new Date(line.period.end * 1000),
                price_id: line.price?.id
            });
        });

        // Method 1: Sum all proration lines (your current approach)
        const proratedLines = invoice.lines.data.filter(line => line.proration === true);
        const totalProration = proratedLines.reduce((total, line) => total + line.amount, 0);
        
        // Method 2: Alternative - look for lines with the additional assistant price
        const assistantLines = invoice.lines.data.filter(line => 
            line.price?.id === additionalAssistantPriceId && line.amount > 0
        );
        const assistantProration = assistantLines.reduce((total, line) => total + line.amount, 0);
        
        // Method 3: Use the invoice total if it's positive (immediate charge)
        const invoiceTotal = invoice.total;
        
        
        
        // Use the best available amount - prefer proration, fall back to assistant lines, then invoice total
        let finalAmount = totalProration;
        if (finalAmount <= 0) {
            finalAmount = assistantProration;
        }
        if (finalAmount <= 0) {
            finalAmount = Math.max(0, invoiceTotal);
        }
        
        const proratedAmount = (finalAmount / 100).toFixed(2);
        
        console.log('Final prorated amount:', proratedAmount);

        res.json({ 
            proratedPrice: proratedAmount,
            debug: {
                totalProration: (totalProration / 100).toFixed(2),
                assistantProration: (assistantProration / 100).toFixed(2),
                invoiceTotal: (invoiceTotal / 100).toFixed(2)
            }
        });
    } catch (error) {
        console.error("Error fetching proration preview:", error);
        res.status(500).json({ message: 'Failed to calculate prorated price.' });
    }
});

app.get('/api/me', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Not logged in' });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.session.userId },
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user data.' });
    }
});

// === ASSISTANT MANAGEMENT ROUTES ===

// GET all assistants for the logged-in user
app.get('/api/assistants', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const assistants = await prisma.assistant.findMany({ where: { userId: req.session.userId } });
        res.json(assistants);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch assistants' }); }
});

// CREATE a new Assistant
app.post('/api/assistant', isVerified, upload.any(), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { name, instructions, avatarUrl, role } = req.body;
        const files = Array.isArray(req.files) ? req.files : [];
        const userId = req.session.userId;
        let fileIds = [];

        console.log({
  filesCreate: !!openai.files?.create,
  vsCreate: !!(openai.beta?.vectorStores?.create || openai.vectorStores?.create),
  vsFilesCreate: !!(openai.beta?.vectorStores?.files?.create || openai.vectorStores?.files?.create),
  asstCreate: !!(openai.beta?.assistants?.create || openai.assistants?.create),
});

        // 1. Upload files to OpenAI if they exist
        if (files.length) {
            for (const file of files) {
            const fileForUpload = new File([file.buffer], file.originalname || 'upload', {
                type: file.mimetype || 'application/octet-stream'
            });
            const oaiFile = await openai.files.create({
                file: fileForUpload,
                purpose: 'assistants',
            });
            fileIds.push(oaiFile.id);
        }
        }

        // 2. Create a Vector Store if there are files
        let vectorStoreId;
        if (fileIds.length > 0) {
            const vectorStore = await vsCreate({ name: `${name} Knowledge Base`, file_ids: fileIds });
            vectorStoreId = vectorStore.id;
        }

        // 3. Create the assistant on OpenAI's platform
        const assistant = await asstCreate ({
            name: name,
            instructions: instructions,
            model: "gpt-4o",
            tools: [{ type: "file_search" }],
            tool_resources: vectorStoreId ? { file_search: { vector_store_ids: [vectorStoreId] } } : undefined,
        });

        // 4. Create the new assistant record in OUR database with the REAL OpenAI ID
        const newDbAssistant = await prisma.assistant.create({
            data: {
                name: assistant.name,
                instructions: assistant.instructions,
                avatarUrl,
                role,
                openaiAssistantId: assistant.id, // <-- Use the real, unique ID from OpenAI
                userId: userId,
            }
        });
        
        console.log(`Assistant ${newDbAssistant.id} (OpenAI ID: ${assistant.id}) created for user ${userId}`);
        res.status(201).json(newDbAssistant);

    } catch (error) {
        console.error('Error creating assistant:',
            error?.status, error?.message, error?.response?.data || error);
        return res.status(500).json({ message: 'Failed to create assistant.' });
    }
});


// GET a single assistant by its ID
app.get('/api/assistant/:id', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const { id } = req.params;

    // Verify ownership
    const dbAssistant = await prisma.assistant.findUnique({ where: { id } });
    if (!dbAssistant || dbAssistant.userId !== req.session.userId) {
      return res.status(403).json({ message: 'Permission denied.' });
    }

    // Try to fetch OpenAI resources using helpers that work across SDKs.
    let files = [];
    try {
      const oaiAssistant = await asstRetrieve(dbAssistant.openaiAssistantId); // <-- use helper
      const vectorStoreId = oaiAssistant.tool_resources?.file_search?.vector_store_ids?.[0];

      if (vectorStoreId) {
        const list = await vsFilesList(vectorStoreId);     // <-- use helper
        const detailed = await Promise.all(
          (list.data || []).map(async (item) => {
            const f = await openai.files.retrieve(item.id);
            return { id: f.id, filename: f.filename, bytes: f.bytes };
          })
        );
        files = detailed;
      }
    } catch (oaiErr) {
      console.warn('OpenAI assistant lookup failed; returning DB assistant anyway:', oaiErr?.message || oaiErr);
      // Optional: include a flag so the UI can show a soft warning
      // return res.json({ assistant: dbAssistant, files, openaiStatus: 'unavailable' });
    }

    return res.json({ assistant: dbAssistant, files });
  } catch (error) {
    console.error('Failed to fetch assistant:', error);
    return res.status(500).json({ message: 'Failed to fetch assistant.' });
  }
});

// DELETE a specific assistant
app.delete('/api/assistant/:id', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    
    try {
        const { id } = req.params; // This is the ID from our database
        const assistantInDb = await prisma.assistant.findUnique({ where: { id: id } });

        // Security Check: Make sure the logged-in user owns this assistant
        if (!assistantInDb || assistantInDb.userId !== req.session.userId) {
            return res.status(403).json({ message: 'Permission denied.' });
        }
        
        const openaiAssistantId = assistantInDb.openaiAssistantId;

        // --- NEW: FULL CLEANUP LOGIC FOR OPENAI ---
        try {
            // 1. Retrieve the assistant from OpenAI to find its resources
            const assistant = await openai.beta.assistants.retrieve(openaiAssistantId);
            
            // 2. Find the attached Vector Store ID
            const vectorStoreId = assistant.tool_resources?.file_search?.vector_store_ids?.[0];

            if (vectorStoreId) {
                console.log(`Found Vector Store ${vectorStoreId} to delete.`);
                // 3. List and delete all files within the Vector Store
                const vectorStoreFiles = await openai.beta.vectorStores.files.list(vectorStoreId);
                for (const file of vectorStoreFiles.data) {
                    await openai.beta.vectorStores.files.del(vectorStoreId, file.id);
                    await openai.files.del(file.id); // Also delete the file object itself
                    console.log(`Deleted file ${file.id} from Vector Store.`);
                }
                
                // 4. Delete the Vector Store itself
                await openai.beta.vectorStores.del(vectorStoreId);
                console.log(`Deleted Vector Store ${vectorStoreId}.`);
            }
            
            // 5. Now, safely delete the assistant from OpenAI
            await openai.beta.assistants.del(openaiAssistantId);
            console.log(`Assistant ${openaiAssistantId} deleted from OpenAI.`);

        } catch (oaiError) {
            // If the assistant doesn't exist on OpenAI for some reason, log it but don't stop.
            console.error(`Could not fully clean up assistant ${openaiAssistantId} on OpenAI, it might have been deleted already. Error: ${oaiError.message}`);
        }
        
        // 6. Finally, delete the assistant from our database
        await prisma.assistant.delete({ where: { id: id } });
        console.log(`Assistant ${id} deleted from our database.`);

        res.status(204).send();

    } catch (error) {
        console.error('Error in main delete assistant route:', error);
        res.status(500).json({ message: 'Failed to delete assistant.' });
    }
});

app.get('/api/proration-preview/:quantity', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
        if (!user || !user.stripeSubscriptionId) return res.status(403).json({ message: 'User is not subscribed.' });

        const newQuantity = parseInt(req.params.quantity, 10);
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        const additionalAssistantPriceId = process.env.PRICE_ID_ADDITIONAL_ASSISTANT;
        
        const currentItems = subscription.items.data.map(item => {
        const obj = { quantity: item.quantity };
        if (item.price.id === additionalAssistantPriceId) {
            obj.id = item.id; // Update existing add-on slot item
            obj.quantity = newQuantity;
        } else {
            obj.id = item.id; // Keep other items unchanged
        }
        return obj;
    });

    // If there's no existing add-on item and user is adding new slots, add it as a new item
    const hasAddOn = subscription.items.data.some(item => item.price.id === additionalAssistantPriceId);
    if (!hasAddOn && newQuantity > 0) {
        currentItems.push({
            price: additionalAssistantPriceId,
            quantity: newQuantity
        });
    }

        
        const invoice = await stripe.invoices.createPreview({
            customer: user.stripeCustomerId,
            subscription: user.stripeSubscriptionId,
            subscription_details: {
                items: currentItems,
                proration_behavior: 'always_invoice'
            }
        });
        
        const proratedAmount = (invoice.amount_due / 100).toFixed(2);
        res.json({ proratedPrice: proratedAmount });
    } catch (error) {
        console.error("Error fetching proration preview:", error);
        res.status(500).json({ message: 'Failed to calculate prorated price.' });
    }
});

app.post('/api/manage-slots', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const { newSlotCount } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    if (!user || !user.stripeSubscriptionId) {
      return res.status(403).json({ message: 'User is not subscribed.' });
    }

    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const additionalAssistantPriceId = process.env.PRICE_ID_ADDITIONAL_ASSISTANT;

    const existingItem = subscription.items.data.find(item =>
      item.price.id === additionalAssistantPriceId
    );

    const currentSlotCount = user.addOnSlots;

    if (newSlotCount > currentSlotCount) {
      // ✅ Immediate upgrade
      if (existingItem) {
        await stripe.subscriptionItems.update(existingItem.id, {
          quantity: newSlotCount,
          proration_behavior: 'always_invoice'
        });
      } else {
        await stripe.subscriptionItems.create({
          subscription: user.stripeSubscriptionId,
          price: additionalAssistantPriceId,
          quantity: newSlotCount,
          proration_behavior: 'always_invoice'
        });
      }

      await prisma.user.update({
        where: { id: req.session.userId },
        data: {
          addOnSlots: newSlotCount,
          pendingAddOnSlots: null
        }
      });

    } else if (newSlotCount < currentSlotCount) {
      // ✅ Downgrade takes effect at next renewal
      await prisma.user.update({
        where: { id: req.session.userId },
        data: {
            pendingAddOnSlots: newSlotCount
        }
    });
    }

    res.json({ message: 'Slots updated or scheduled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update slots.' });
  }
});

app.post('/api/cancel-pending-downgrade', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

    // Set Stripe subscription back to current addOnSlots
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
    const existingItem = subscription.items.data.find(item => item.price.id === process.env.PRICE_ID_ADDITIONAL_ASSISTANT);

    if (existingItem) {
      await stripe.subscriptionItems.update(existingItem.id, {
        quantity: user.addOnSlots,
        proration_behavior: 'none'
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { pendingAddOnSlots: null }
    });

    res.json({ message: 'Pending downgrade canceled.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to cancel downgrade.' });
  }
});

app.post('/api/cancel-pending-plan-downgrade', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pendingPlan: null,
      },
    });

    res.json({ message: 'Pending plan downgrade cancelled.' });
  } catch (err) {
    console.error('cancel pending plan downgrade error:', err);
    res.status(500).json({ message: 'Failed to cancel pending plan downgrade.' });
  }
});


app.put('/api/assistant/:id', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const { id } = req.params;
        const { name, instructions, avatarUrl, role } = req.body;
        const assistantInDb = await prisma.assistant.findUnique({ where: { id } });
        if (!assistantInDb || assistantInDb.userId !== req.session.userId) {
            return res.status(403).json({ message: 'Permission denied.' });
        }
        await openai.beta.assistants.update(assistantInDb.openaiAssistantId, { name, instructions });
        const updatedOaiAssistant = await openai.beta.assistants.update(assistantInDb.openaiAssistantId, { name, instructions });
        const updatedDbAssistant = await prisma.assistant.update({ where: { id }, data: { name, instructions, avatarUrl, role } });
        res.json(updatedDbAssistant);
    } catch (error) { res.status(500).json({ message: 'Failed to update assistant.' }); }
});

// --- GOOGLE CONNECTION ROUTES (Per-Assistant) ---
app.get('/auth/google', isVerified, (req, res) => {
    const { assistantId } = req.query;
    if (!req.session.userId || !assistantId) return res.status(400).send('Missing user session or assistant ID');
    const oauth2Client = createOAuth2Client();
    const state = JSON.stringify({ userId: req.session.userId, assistantId });
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: scopes, state });
    res.redirect(url);
});

app.get('/auth/google/callback', isVerified, async (req, res) => {
    try {
        const { code, state } = req.query; // Get the code and the state string

        // --- THIS IS THE FIX ---
        // We must parse the 'state' string itself, not the entire query object.
        const { userId, assistantId } = JSON.parse(state);
        // --- END OF FIX ---

        if (!userId || !assistantId) {
            return res.status(400).send('Invalid state parameter');
        }
        
        const oauth2Client = createOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        const profile = await gmail.users.getProfile({ userId: 'me' });
        const emailAddress = profile.data.emailAddress;

        await prisma.assistant.update({
            where: { id: assistantId },
            data: { 
                googleTokens: tokens,
                emailAddress: emailAddress,
            }
        });

        // Start watching the inbox now that we are connected
        await startWatchingInbox(assistantId);
        
        // Redirect back to the specific assistant's page
        res.redirect(`${FRONTEND_URL}/assistant/${assistantId}`);

    } catch (error) {
        console.error("Error in Google callback:", error);
        res.redirect(`${FRONTEND_URL}/assistants`);
    }
});

app.post('/auth/google/disconnect/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const { assistantId } = req.params;
        const assistant = await prisma.assistant.findUnique({ where: { id: assistantId } });
        if (!assistant || assistant.userId !== req.session.userId) return res.status(403).json({ message: 'Permission denied.' });
        if (assistant.googleTokens) {
            const oauth2Client = createOAuth2Client();
            const refreshToken = assistant.googleTokens.refresh_token;
            if (refreshToken) await oauth2Client.revokeToken(refreshToken);
            await prisma.assistant.update({ where: { id: assistantId }, data: { googleTokens: null } });
        }
        res.json({ message: 'Google account disconnected successfully.' });
    } catch (error) { res.status(500).json({ message: 'Failed to disconnect Google account.' }); }
});

app.get('/api/emails/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { assistantId } = req.params;

        // Find the assistant and check if the logged-in user owns it
        const assistant = await prisma.assistant.findUnique({ where: { id: assistantId } });
        if (!assistant || assistant.userId !== req.session.userId) {
            return res.status(403).json({ message: 'Permission denied.' });
        }

        // Check if this specific assistant is connected to Google
        if (!assistant.googleTokens) {
            return res.status(400).json({ message: 'This assistant is not connected to a Gmail account.' });
        }

        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials(assistant.googleTokens); // Use the assistant's tokens
        
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const listResponse = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 5,
        });

        const messages = listResponse.data.messages;
        if (!messages || messages.length === 0) {
            return res.json([]); // Return an empty array if no emails
        }

        // Fetch details for each email
        const emailDetails = await Promise.all(
            messages.map(async (message) => {
                const detailResponse = await gmail.users.messages.get({
                    userId: 'me',
                    id: message.id,
                });
                const headers = detailResponse.data.payload.headers;
                const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                const from = headers.find(h => h.name === 'From')?.value || 'No Sender';
                return {
                    id: message.id,
                    threadId: message.threadId,
                    subject,
                    from,
                    snippet: detailResponse.data.snippet,
                };
            })
        );
        res.json(emailDetails);

    } catch (error) {
        console.error('Error fetching emails for assistant:', error);
        res.status(500).json({ message: 'Failed to fetch emails' });
    }
});

// --- FILE MANAGEMENT (PER-ASSISTANT) ---
app.post('/api/assistant/:assistantId/files', isVerified, upload.any(), async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
  try {
    const { assistantId } = req.params;

    // Ownership
    const user = await prisma.user.findUnique({ where: { id: req.session.userId }, include: { assistants: true } });
    const assistant = user.assistants.find(a => a.id === assistantId);
    if (!assistant) return res.status(403).json({ message: 'Permission denied.' });

    // Get OpenAI assistant via helper (works across SDK versions)
    const oaiAssistant = await asstRetrieve(assistant.openaiAssistantId); // <-- helper
    let vectorStoreId = oaiAssistant.tool_resources?.file_search?.vector_store_ids?.[0];

    // If no VS yet, create + attach one so uploads always work
    if (!vectorStoreId) {
      const vs = await vsCreate({ name: `${assistant.name} Knowledge Base` }); // <-- helper
      vectorStoreId = vs.id;

      // Update assistant to reference the newly created VS (handle beta/non-beta)
      const asstNs = (openai.beta?.assistants) ?? openai.assistants;
      await asstNs.update(assistant.openaiAssistantId, {
        tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
      });
    }

    // Accept single or multiple uploads
    const incoming = Array.isArray(req.files) && req.files.length ? req.files : (req.file ? [req.file] : []);
    if (!incoming.length) return res.status(400).json({ message: 'No files uploaded.' });

    const uploaded = [];
    for (const f of incoming) {
      // Node-safe file conversion
      const fileForUpload = await toFile(f.buffer, f.originalname || 'upload', {
        type: f.mimetype || 'application/octet-stream',
      });

      // Create file + attach to vector store (helpers)
      const oaiFile = await filesCreate({ file: fileForUpload, purpose: 'assistants' });
      await vsFilesCreate(vectorStoreId, { file_id: oaiFile.id });

      uploaded.push({ id: oaiFile.id, name: f.originalname || 'upload' });
    }

    return res.status(201).json({ uploaded });
  } catch (error) {
    console.error('add-file failed:', error?.status, error?.message, error?.response?.data || error);
    return res.status(500).json({ message: 'Failed to add file.' });
  }
});

app.delete('/api/assistant/:assistantId/files/:fileId', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

  try {
    const { assistantId, fileId } = req.params;

    // Ownership check
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { assistants: true }
    });
    const assistant = user.assistants.find(a => a.id === assistantId);
    if (!assistant) return res.status(403).json({ message: 'Permission denied.' });

    // Use cross-version helper (works with/without beta)
    const oaiAssistant = await asstRetrieve(assistant.openaiAssistantId);
    const vectorStoreId = oaiAssistant.tool_resources?.file_search?.vector_store_ids?.[0];

    // If no VS, nothing to detach — treat as success
    if (!vectorStoreId) return res.status(204).send();

    // Detach from Vector Store (ignore 404s to be idempotent)
    try { await vsFilesDel(vectorStoreId, fileId); } catch (e) {
      if (e?.status !== 404) throw e;
    }

    // Delete the File object (ignore 404s)
    try { await filesDel(fileId); } catch (e) {
      if (e?.status !== 404) throw e;
    }

    return res.status(204).send();
  } catch (error) {
    console.error('remove-file failed:', error?.status, error?.message, error?.response?.data || error);
    return res.status(500).json({ message: 'Failed to remove file.' });
  }
});

// GET A LIST OF THREADS for a specific assistant
app.get('/api/threads/:assistantId', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
  const { assistantId } = req.params;

  try {
    // Serve cached if <60s old
    const c = threadsCache.get(assistantId);
    if (c && Date.now() - c.timestamp < 60_000) {
      return res.json(c.threads);
    }

    const assistant = await prisma.assistant.findUnique({ where: { id: assistantId } });
    if (!assistant || assistant.userId !== req.session.userId) {
      return res.status(403).json({ message: 'Permission denied.' });
    }
    if (!assistant.googleTokens) {
      return res.json([]);
    }

    const gmail = await getGmailClientAndPersist(assistant);

    // Get your address (cached daily)
    // NEW: read the stored address directly
    const userEmail = assistant.emailAddress;
    if (!userEmail) {
      return res.status(500).json({ message: 'No emailAddress on assistant—please reconnect Gmail.' });
    }

    // List threads
    const listRes = await gmailWithBackoff(() =>
      gmail.users.threads.list({ userId: 'me', maxResults: 25, q: 'is:inbox' })
    );
    const threads = await Promise.all(
      (listRes.data.threads || []).map(async t => {
        const details = await gmailWithBackoff(() =>
          gmail.users.threads.get({ userId: 'me', id: t.id })
        );
        const lastMsg = details.data.messages.slice(-1)[0];
        const hdrs = lastMsg.payload.headers;
        const subjectHdr = hdrs.find(h => h.name === 'Subject')?.value || '';
        const fromHdr   = hdrs.find(h => h.name === 'From')?.value || '';
        const messageId = lastMsg.id;
        const log       = await prisma.emailLog.findFirst({
          where: { gmailMessageId: messageId }
        });

        return {
          id: t.id,
          snippet: lastMsg.snippet,
          subject: subjectHdr.replace(/^Re:\s*/i, ''),
          from: fromHdr.split('<')[0].trim(),
          date: Number(lastMsg.internalDate),
          status: log ? log.status : null
        };
      })
    );

    // Sort, cache, return
    threads.sort((a, b) => b.date - a.date);
    threadsCache.set(assistantId, { timestamp: Date.now(), threads });
    res.json(threads);

  } catch (error) {
    console.error('Error fetching threads:', error);
    if (error.response?.status === 429) {
      const stale = threadsCache.get(assistantId);
      if (stale) {
        return res.json(stale.threads);
      }
      const ra = error.response.headers['retry-after'];
      if (ra) res.set('Retry-After', ra);
      return res.status(503).json({ message: 'Gmail rate limit exceeded, try again later.' });
    }
    if (error.response?.status === 401) {
      // clear tokens so front‑end prompts reconnect
      await prisma.assistant.update({
        where: { id: assistantId },
        data: { googleTokens: null }
      });
      return res.status(401).json({ message: 'Gmail auth expired, please reconnect.' });
    }
    res.status(500).json({ message: 'Failed to fetch threads.' });
  }
});

// GET FULL CONTENT of a specific thread
app.get('/api/thread/:assistantId/:threadId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const { assistantId, threadId } = req.params;
        const assistant = await prisma.assistant.findUnique({ where: { id: assistantId } });
        if (!assistant || assistant.userId !== req.session.userId) return res.status(403).json({ message: 'Permission denied.' });
        if (!assistant.googleTokens) return res.status(400).json({ message: 'Gmail not connected.' });

        const oauth2Client = createOAuth2Client();
        oauth2Client.setCredentials(assistant.googleTokens);
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const threadResponse = await gmail.users.threads.get({ userId: 'me', id: threadId });
        
        const cleanText = (text) => {
            const lines = text.split('\n');
            const junkPatterns = ['unsubscribe', 'view in browser', 'update your preferences', 'no longer wish to receive', 'all rights reserved', 'upvotes', 'comments', 'hide r/', 'view more posts', 'this email was intended for', 'san francisco, ca'];
            const cleanLines = lines.filter(line => {
                const lowerLine = line.toLowerCase();
                return !junkPatterns.some(pattern => lowerLine.includes(pattern));
            });
            let cleanedText = cleanLines.join('\n');
            cleanedText = cleanedText.replace(/(&#\d+;|\s*&zwnj;&nbsp;)+/g, ' ').replace(/Read More/gi, '').replace(/•/g, '');
            return cleanedText.replace(/(\n\s*){3,}/g, '\n\n').trim();
        };

        const getBody = (payload) => {
            let body = {
                plain: '',
                html: ''
            };
            const findParts = (parts) => {
                for (let part of parts) {
                    if (part.mimeType === 'text/plain' && part.body.data) {
                        body.plain += Buffer.from(part.body.data, 'base64').toString('utf8');
                    } else if (part.mimeType === 'text/html' && part.body.data) {
                        body.html += Buffer.from(part.body.data, 'base64').toString('utf8');
                    } else if (part.parts) {
                        findParts(part.parts);
                    }
                }
            };
            if (payload.parts) {
                findParts(payload.parts);
            } else if (payload.body && payload.body.data) {
                if (payload.mimeType === 'text/plain') {
                    body.plain = Buffer.from(payload.body.data, 'base64').toString('utf8');
                } else if (payload.mimeType === 'text/html') {
                    body.html = Buffer.from(payload.body.data, 'base64').toString('utf8');
                }
            }
            if (body.plain) return cleanText(body.plain);
            if (body.html) return cleanText(body.html.replace(/<style[^>]*>.*<\/style>/gis, '').replace(/<script[^>]*>.*<\/script>/gis, '').replace(/<[^>]*>/g, ''));
            return '';
        };

        const messages = threadResponse.data.messages.map(message => {
            const payload = message.payload;
            const from = payload.headers.find(h => h.name === 'From')?.value || 'No Sender';
            const body = getBody(payload);
            return { id: message.id, from, body };
        });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching full thread:', error);
        res.status(500).json({ message: 'Failed to fetch full thread' });
    }
});

// GENERATE AI REPLY for a specific assistant and conversation
app.post('/api/generate-reply', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const { conversation, assistantId } = req.body;
        const assistantInDb = await prisma.assistant.findUnique({ where: { id: assistantId } });
        if (!assistantInDb || assistantInDb.userId !== req.session.userId) {
            return res.status(403).json({ message: 'Permission denied.' });
        }
        
        const thread = await openai.beta.threads.create({ messages: [{ role: 'user', content: conversation }] });
        const run = await openai.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: assistantInDb.openaiAssistantId, // Use the correct assistant ID from DB
        });

        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(thread.id);

            // --- ADD THIS LOGGING LOGIC ---
            await prisma.emailLog.create({
                data: {
                    action: 'REPLY_GENERATED',
                    assistantId: assistantInDb.id, // Link the log to the correct assistant
                }
            });
            console.log(`Logged successful reply generation for assistant: ${assistantInDb.id}`);
            // --- END OF NEW LOGIC ---

            res.json({ reply: messages.data[0].content[0].text.value });
        } else {
            res.status(500).json({ message: `AI Run failed with status: ${run.status}` });
        }
    } catch (error) { res.status(500).json({ message: 'Failed to generate reply.' }); }
});

// Fixed version of your email sending code
app.post('/api/send-email', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    console.log('🔔 [send-email] called, threadId:', req.body.threadId);
    try {
        const { assistantId, threadId, replyText } = req.body;
        const assistant = await prisma.assistant.findUnique({ where: { id: assistantId } });
        if (!assistant || assistant.userId !== req.session.userId) return res.status(403).json({ message: 'Permission denied.' });
        if (!assistant.googleTokens) return res.status(400).json({ message: 'Gmail not connected.' });

        const gmail = await getGmailClientAndPersist(assistant);
        
        // 1. Fetch the entire thread to get all message IDs for referencing
        const thread = await gmailWithBackoff(() => gmail.users.threads.get({ userId: 'me', id: threadId }));
        const messages = thread.data.messages;
        if (!messages || messages.length === 0) {
            return res.status(400).json({ message: 'Cannot reply to an empty thread.' });
        }

        // --- THIS IS THE FIX FOR THREADING ---
        // Correctly parse all necessary headers from the LAST message for context
        const lastMsg = messages[messages.length - 1];
        const lastMsgHeaders = lastMsg.payload.headers;
        const subject = lastMsgHeaders.find(h => h.name.toLowerCase() === 'subject')?.value || '';
        const fromHeader = lastMsgHeaders.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const toAddress = parseEmail(fromHeader);
        const lastMessageId = lastMsgHeaders.find(h => h.name.toLowerCase() === 'message-id')?.value;
        if (!lastMessageId) {
          console.error('❌ Could not find Message-ID on the last message headers:', lastMsgHeaders);
          return res.status(500).json({ message: 'Reply failed: no Message-ID found on that thread.' });
        }

        // Construct the new References header by chaining all previous Message-IDs
        const allMessageIds = messages.map(msg => 
            msg.payload.headers.find(h => h.name.toLowerCase() === 'message-id')?.value
        ).filter(Boolean); // Filter out any messages that might not have an ID

        const newReferences = allMessageIds.join(' ');
        // --- END OF FIX ---
        
        const myEmail = assistant.emailAddress;
        if (!myEmail) throw new Error("Assistant's own email address is not configured.");

        const log = await prisma.emailLog.create({
            data: { assistantId, threadId, action: 'REPLY_SENT', status: 'sent', recipientEmail: toAddress }
        });
        
        const htmlBody = `<div dir="auto">${replyText.replace(/\n/g, '<br>')}</div><img src="${process.env.APP_URL || 'http://localhost:3001'}/track/open/${log.id}" width="1" height="1" alt="">`;

        const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        
        const rawMessageParts = [
            `From: ${myEmail}`,
            `To: ${toAddress}`,
            `Subject: ${subject.startsWith('Re:') ? subject : `Re: ${subject}`}`,
            `In-Reply-To: ${lastMessageId}`,
            `References: ${newReferences}`,
            'MIME-Version: 1.0',
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            '',
            `--${boundary}`,
            'Content-Type: text/plain; charset="UTF-8"',
            '',
            replyText,
            '',
            `--${boundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            '',
            htmlBody,
            '',
            `--${boundary}`
        ];

        const rawMessage = rawMessageParts.join('\r\n');
        const encodedMessage = Buffer.from(rawMessage).toString('base64url');

        const sendRes = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage,
                threadId: threadId,
            }
        });

        await prisma.emailLog.update({ where: { id: log.id }, data: { gmailMessageId: sendRes.data.id } });
        
        try {
          await scheduleEmailMonitoring(assistantId, threadId, log.id);
        } catch (monitorErr) {
          console.error('❌ scheduleEmailMonitoring error:', monitorErr);
        }

        res.json({ message: 'Reply sent successfully!', trackingId: log.id });
    } catch (err) {
        console.error('❌ Error sending email:', err);
        res.status(500).json({ message: 'Failed to send email.' });
    }
});

// ALTERNATIVE TRACKING METHOD 1: Gmail API Monitoring
async function scheduleEmailMonitoring(assistantId, threadId, logId) {
    console.log('🔍 Starting Gmail API monitoring for thread:', threadId);
    
    let checkCount = 0;
    const maxChecks = 48; // 24 hours worth of checks (every 30 minutes)
    
    // Wait a bit before starting monitoring to let the message appear in the thread
    setTimeout(() => {
        const checkInterval = setInterval(async () => {
            try {
                checkCount++;
                console.log(`📊 Monitoring check ${checkCount}/${maxChecks} for thread ${threadId}`);
                
                const shouldStop = await checkEmailReadStatus(assistantId, threadId, logId);
                
                // Stop if email was opened or max checks reached
                if (shouldStop || checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                    console.log(`⏰ Stopped monitoring thread ${threadId} - ${shouldStop ? 'Email opened' : 'Max checks reached'}`);
                }
            } catch (error) {
                console.error('❌ Error in monitoring interval:', error);
                clearInterval(checkInterval);
            }
        }, 30000); // Check every 30 seconds
    }, 5000); // Wait 5 seconds before starting monitoring
}

// ✅ FIXED: More robust email read status checking
async function checkEmailReadStatus(assistantId, threadId, logId) {
    try {
        // Check if already updated to avoid unnecessary API calls
        const currentLog = await prisma.emailLog.findUnique({ 
            where: { id: logId },
            select: { status: true, gmailMessageId: true }
        });
        
        if (currentLog?.status !== 'sent') {
            console.log(`📬 Email ${logId} already has status: ${currentLog?.status}`);
            return true; // Stop monitoring
        }

        const assistant = await prisma.assistant.findUnique({ 
            where: { id: assistantId },
            select: { googleTokens: true, emailAddress: true }
        });
        
        if (!assistant?.googleTokens) {
            console.log('❌ No Google tokens found, stopping monitoring');
            return true;
        }
        
        const gmail = await getGmailClientAndPersist(assistant);
        
        // ✅ IMPROVED: Use the stored Gmail message ID if available
        if (currentLog?.gmailMessageId) {
            try {
                const message = await gmailWithBackoff(() =>
                    gmail.users.messages.get({
                        userId: 'me',
                        id: currentLog.gmailMessageId,
                        format: 'minimal'
                    })
                );
                
                const hasUnreadLabel = message.data.labelIds && message.data.labelIds.includes('UNREAD');
                
                if (!hasUnreadLabel) {
                    console.log('📖 Email has been read (no UNREAD label on our message)');
                    await updateEmailStatus(logId, 'opened');
                    return true; // Stop monitoring
                }
                
                console.log('📧 Our message still has UNREAD label, continuing monitoring...');
                return false; // Continue monitoring
                
            } catch (msgError) {
                console.log('⚠️ Could not check individual message, falling back to thread check');
            }
        }
        
        // ✅ FALLBACK: Check the entire thread
        const thread = await gmailWithBackoff(() =>
            gmail.users.threads.get({ 
                userId: 'me', 
                id: threadId,
                format: 'full'
            })
        );

        console.log(`🔍 Thread has ${thread.data.messages.length} messages`);
        
        // Find our sent message in the thread (more reliable approach)
        let ourMessage = null;
        
        // Method 1: Try to find by Gmail message ID
        if (currentLog?.gmailMessageId) {
            ourMessage = thread.data.messages.find(msg => msg.id === currentLog.gmailMessageId);
            if (ourMessage) {
                console.log('✅ Found our message by Gmail ID');
            }
        }
        
        // Method 2: Find by sender email if Method 1 fails
        if (!ourMessage && assistant.emailAddress) {
            ourMessage = thread.data.messages.find(msg => {
                const fromHeader = msg.payload.headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
                return fromHeader.includes(assistant.emailAddress);
            });
            if (ourMessage) {
                console.log('✅ Found our message by sender email');
            }
        }
        
        // Method 3: Check the latest message if it's recent (last fallback)
        if (!ourMessage && thread.data.messages.length > 0) {
            const latestMessage = thread.data.messages[thread.data.messages.length - 1];
            const messageTime = parseInt(latestMessage.internalDate);
            const now = Date.now();
            const fiveMinutesAgo = now - (5 * 60 * 1000);
            
            if (messageTime > fiveMinutesAgo) {
                const fromHeader = latestMessage.payload.headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
                if (fromHeader.includes(assistant.emailAddress)) {
                    ourMessage = latestMessage;
                    console.log('✅ Found our message as latest recent message');
                }
            }
        }

        if (!ourMessage) {
            console.log('🤔 Could not find our sent message in thread, continuing to monitor...');
            return false; // Continue monitoring
        }

        // Check if our message has been read (no UNREAD label)
        const hasUnreadLabel = ourMessage.labelIds && ourMessage.labelIds.includes('UNREAD');
        
        if (!hasUnreadLabel) {
            console.log('📖 Email has been read (no UNREAD label)');
            await updateEmailStatus(logId, 'opened');
            return true; // Stop monitoring
        }
        
        console.log('📧 Email still has UNREAD label, continuing monitoring...');
        return false; // Continue monitoring
        
    } catch (error) {
        console.error('❌ Error checking email read status:', error);
        return false; // Continue monitoring instead of stopping on error
    }
}

// ALTERNATIVE TRACKING METHOD 2: Link Click Tracking
app.get('/track/click/:trackingId', isVerified, async (req, res) => {
  const trackingId = req.params.trackingId;
  console.log('🔗 Link click tracking hit for ID:', trackingId);
  
  await updateEmailStatus(trackingId, 'clicked');
  
  // Redirect to a helpful page or back to sender's website
  res.redirect('https://www.google.com');
});

// Unsubscribe link (also acts as tracking)
app.get('/unsubscribe/:trackingId', isVerified, async (req, res) => {
  const trackingId = req.params.trackingId;
  console.log('🚫 Unsubscribe tracking hit for ID:', trackingId);
  
  await updateEmailStatus(trackingId, 'clicked');
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Unsubscribed</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 400px; margin: 0 auto; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Successfully Unsubscribed</h2>
            <p>You have been removed from future emails.</p>
            <p><a href="mailto:${req.query.email || ''}">Contact us</a> if you have any questions.</p>
        </div>
    </body>
    </html>
  `);
});

// ALTERNATIVE TRACKING METHOD 3: Webhook for Email Services
app.post('/webhook/email-status', isVerified, async (req, res) => {
  const { trackingId, event, timestamp } = req.body;
  
  console.log('📨 Webhook received:', { trackingId, event, timestamp });
  
  if (event === 'opened') {
    await updateEmailStatus(trackingId, 'opened');
  } else if (event === 'clicked') {
    await updateEmailStatus(trackingId, 'clicked');
  }
  
  res.json({ status: 'success' });
});

// Enhanced status update function
async function updateEmailStatus(trackingId, newStatus) {
    if (!trackingId) {
        console.log('❌ No tracking ID provided');
        return;
    }
    
    try {
        console.log('🔄 Attempting to update status for ID:', trackingId, 'to:', newStatus);
        
        const existing = await prisma.emailLog.findUnique({
            where: { id: trackingId }
        });
        
        if (!existing) {
            console.log('❌ Email log not found for ID:', trackingId);
            return;
        }
        
        const statusHierarchy = {
            'sent': 0,
            'opened': 2,
            'clicked': 3
        };
        
        const currentLevel = statusHierarchy[existing.status] || 0;
        const newLevel = statusHierarchy[newStatus] || 0;
        
        if (newLevel > currentLevel) {
            const updateData = { 
                status: newStatus,
                action: newStatus === 'opened' ? 'REPLY_OPENED' : 'REPLY_CLICKED'
            };
            
            // Add timestamp fields
            if (newStatus === 'opened') {
                updateData.openedAt = new Date();
            } else if (newStatus === 'clicked') {
                updateData.clickedAt = new Date();
            }
            
            const updated = await prisma.emailLog.update({
                where: { id: trackingId },
                data: updateData
            });
            
            console.log('✅ Email status updated successfully:', {
                id: updated.id,
                oldStatus: existing.status,
                newStatus: updated.status,
                recipientEmail: updated.recipientEmail,
                timestamp: new Date().toISOString()
            });
            
        } else {
            console.log('ℹ️ Status not updated - current level:', currentLevel, 'new level:', newLevel);
        }
    } catch (err) {
        console.error("❌ Error updating email status:", err);
    }
}

app.get('/api/stats/tracking/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { assistantId } = req.params;
        const assistant = await prisma.assistant.findFirst({ where: { id: assistantId, userId: req.session.userId }});
        if (!assistant) return res.status(403).json({ message: 'Permission denied.' });

        // --- NEW: More detailed queries ---
        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const totalSent = await prisma.emailLog.count({
            where: { assistantId: assistantId, action: 'REPLY_SENT' },
        });

        const totalOpened = await prisma.emailLog.count({
            where: { assistantId: assistantId, status: 'opened' },
        });

        const openedToday = await prisma.emailLog.count({
            where: { assistantId: assistantId, status: 'opened', createdAt: { gte: todayStart } },
        });
        
        const openedLast7Days = await prisma.emailLog.count({
            where: { assistantId: assistantId, status: 'opened', createdAt: { gte: sevenDaysAgo } },
        });

        const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;

        res.json({
            totalSent,
            totalOpened,
            openedToday,
            openedLast7Days,
            openRate: openRate.toFixed(1),
        });

    } catch (error) {
        console.error("Error fetching tracking stats:", error);
        res.status(500).json({ message: "Failed to fetch tracking stats." });
    }
});

app.post('/api/extract-data', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { text } = req.body; // We'll send the email body text here

        if (!text) {
            return res.status(400).json({ message: 'Text to be processed is required.' });
        }

        // A highly specific prompt for data extraction
        const prompt = `
            From the text below, extract the following fields: "name", "email", and "phone".
            Return the result as a single, minified JSON object. 
            The JSON keys must be "name", "email", and "phone".
            If a value is not found for a field, use null for its value.
            Do not include any other text or explanation in your response outside of the JSON object.

            TEXT TO PROCESS:
            """
            ${text}
            """
        `;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o', // Or a faster model like gpt-3.5-turbo
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" }, // Ask for JSON output
        });

        const extractedData = JSON.parse(completion.choices[0].message.content);
        console.log("Extracted Data:", extractedData);
        
        res.json(extractedData);

    } catch (error) {
        console.error('Error with OpenAI data extraction:', error);
        res.status(500).json({ message: 'Failed to extract data.' });
    }
});

// This new route gets the list of saved conversation threads for an assistant
app.get('/api/chat/threads/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const { assistantId } = req.params;
        // Verify ownership
        const assistant = await prisma.assistant.findFirst({ where: { id: assistantId, userId: req.session.userId } });
        if (!assistant) return res.status(403).json({ message: 'Permission denied' });

        const threads = await prisma.chatThread.findMany({
            where: { assistantId: assistantId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(threads);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch chat threads.' }); }
});

app.put('/api/chat/thread/:threadId', isVerified, async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
  const { threadId } = req.params;
  const { title } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });

  try {
    // 1) Fetch the thread record
    const thread = await prisma.chatThread.findUnique({
      where: { openaiThreadId: threadId }
    });
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    // 2) Verify ownership of the assistant
    const assistant = await prisma.assistant.findUnique({
      where: { id: thread.assistantId }
    });
    if (!assistant || assistant.userId !== req.session.userId) {
      return res.status(403).json({ message: 'Permission denied' });
    }

    // 3) Update the title
    const updated = await prisma.chatThread.update({
      where: { openaiThreadId: threadId },
      data: { title }
    });

    res.json(updated);
  } catch (error) {
    console.error('Error renaming chat thread:', error);
    res.status(500).json({ message: 'Failed to rename thread' });
  }
});

// This new route gets the message history for a specific OpenAI thread
app.get('/api/chat/thread/:threadId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const { threadId } = req.params;
        const messages = await openai.beta.threads.messages.list(threadId);
        // Reverse the order to show oldest first, and map to our desired format
        const formattedMessages = messages.data.reverse().map(msg => ({
            role: msg.role,
            content: msg.content[0].text.value
        }));
        res.json(formattedMessages);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch message history.' }); }
});


// Replace your existing /api/chat route with this updated version
app.post('/api/chat', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    try {
        let { assistantId, message, threadId } = req.body;
        const assistantInDb = await prisma.assistant.findFirst({ where: { id: assistantId, userId: req.session.userId } });
        if (!assistantInDb) return res.status(403).json({ message: 'Permission denied.' });

        // If no threadId is provided, create a new one AND save it to our database
        if (!threadId) {
            const thread = await openai.beta.threads.create();
            threadId = thread.id;
            
            // Generate a title for the new chat
            const titleCompletion = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: `Summarize the following message in 5 words or less to use as a chat title: "${message}"` }],
            });
            const title = titleCompletion.choices[0].message.content;

            await prisma.chatThread.create({
                data: {
                    openaiThreadId: threadId,
                    title: title,
                    assistantId: assistantId,
                }
            });
        }

        await openai.beta.threads.messages.create(threadId, { role: 'user', content: message });
        const run = await openai.beta.threads.runs.createAndPoll(threadId, { assistant_id: assistantInDb.openaiAssistantId });

        if (run.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(threadId);
            const response = messages.data[0].content[0].text.value;
            res.json({ reply: response, threadId: threadId });
        } else {
            res.status(500).json({ message: `AI Run failed with status: ${run.status}` });
        }
    } catch (error) {
        console.error('Error in chat route:', error);
        res.status(500).json({ message: 'Failed to get chat response.' });
    }
});

// UPDATE USER'S NAME
app.put('/api/user/profile', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { name } = req.body;
        const updatedUser = await prisma.user.update({
            where: { id: req.session.userId },
            data: { name },
        });
        res.json({ message: 'Profile updated successfully.', user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email } });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update profile.' });
    }
});

// UPDATE USER'S PASSWORD
app.put('/api/user/password', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await prisma.user.findUnique({ where: { id: req.session.userId } });

        const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Incorrect current password.' });
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: req.session.userId },
            data: { passwordHash: newPasswordHash },
        });

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update password.' });
    }
});

app.get('/api/stats/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { assistantId } = req.params;
        const assistant = await prisma.assistant.findFirst({ where: { id: assistantId, userId: req.session.userId } });
        if (!assistant) return res.status(403).json({ message: 'Permission denied.' });

        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const totalEmailsHandled = await prisma.emailLog.count({ where: { assistantId } });
        const emailsToday = await prisma.emailLog.count({ where: { assistantId, createdAt: { gte: todayStart } } });
        const emailsLast7Days = await prisma.emailLog.count({ where: { assistantId, createdAt: { gte: sevenDaysAgo } } });
        const emailsLast30Days = await prisma.emailLog.count({ where: { assistantId, createdAt: { gte: thirtyDaysAgo } } });
        
        res.json({ totalEmailsHandled, emailsToday, emailsLast7Days, emailsLast30Days });

    } catch (error) {
        console.error("Error fetching stats:", error);
        res.status(500).json({ message: "Failed to fetch stats." });
    }
});

app.get('/api/stats/chart/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { assistantId } = req.params;
        const assistant = await prisma.assistant.findFirst({ where: { id: assistantId, userId: req.session.userId }});
        if (!assistant) return res.status(403).json({ message: 'Permission denied.' });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const logs = await prisma.emailLog.findMany({
            where: {
                assistantId: assistantId,
                createdAt: { gte: sevenDaysAgo },
            },
            orderBy: { createdAt: 'asc' },
        });

        // Process logs into daily counts for the last 7 days
        const dailyCounts = {};
        const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayName = dayLabels[d.getDay()];
            dailyCounts[dayName] = 0;
        }

        logs.forEach(log => {
            const dayName = dayLabels[new Date(log.createdAt).getDay()];
            if (dailyCounts.hasOwnProperty(dayName)) {
                dailyCounts[dayName]++;
            }
        });
        
        // Format for Recharts: [{name: 'Mon', count: 5}, ...]
        const chartData = Object.keys(dailyCounts).map(day => ({
            name: day,
            emails: dailyCounts[day],
        })).reverse(); // Reverse to get chronological order for the week

        res.json(chartData);

    } catch (error) {
        console.error("Error fetching chart data:", error);
        res.status(500).json({ message: "Failed to fetch chart data." });
    }
});

app.get('/api/stats/hourly/:assistantId', isVerified, async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const { assistantId } = req.params;
        const assistant = await prisma.assistant.findFirst({ where: { id: assistantId, userId: req.session.userId }});
        if (!assistant) return res.status(403).json({ message: 'Permission denied.' });

        const logs = await prisma.emailLog.findMany({
            where: { assistantId: assistantId },
        });

        // Initialize 24 hours with 0 counts
        const hourlyCounts = Array(24).fill(0).map((_, i) => ({
            hour: i,
            emails: 0,
        }));

        logs.forEach(log => {
            const hour = new Date(log.createdAt).getHours(); // Get hour (0-23)
            if (hourlyCounts[hour]) {
                hourlyCounts[hour].emails++;
            }
        });

        res.json(hourlyCounts);

    } catch (error) {
        console.error("Error fetching hourly chart data:", error);
        res.status(500).json({ message: "Failed to fetch hourly chart data." });
    }
});

app.post('/api/user/avatar', isVerified, avatarUpload.single('avatar'), async (req, res) => {
    if (!req.session.userId) return res.status(401).json({ message: 'Not authenticated' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    try {
        const updatedUser = await prisma.user.update({
            where: { id: req.session.userId },
            data: { imageUrl: req.file.path }, // Save the secure URL from Cloudinary
        });
        res.json({ message: 'Avatar updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update avatar.' });
    }
});

async function applyPendingDowngrades() {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const users = await prisma.user.findMany({
      where: {
        pendingAddOnSlots: { not: null },
        stripeSubscriptionId: { not: null },
      },
    });

    for (const user of users) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['items'],
        });

        const periodEnd = subscription.current_period_end;
        if (!periodEnd || nowSec < periodEnd) continue; // not yet time

        const addOnItem = subscription.items.data.find(
          item => item.price.id === process.env.PRICE_ID_ADDITIONAL_ASSISTANT
        );
        if (!addOnItem) continue;

        // If nothing to change, just clear pending
        if (user.pendingAddOnSlots === user.addOnSlots) {
          await prisma.user.update({
            where: { id: user.id },
            data: { pendingAddOnSlots: null },
          });
          continue;
        }

        // Apply the scheduled downgrade
        await stripe.subscriptionItems.update(addOnItem.id, {
          quantity: user.pendingAddOnSlots,
          proration_behavior: 'none',
        });

        // Re-fetch and sync authoritative slot count
        const updatedSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['items'],
        });
        const updatedAddOnItem = updatedSubscription.items.data.find(
          item => item.price.id === process.env.PRICE_ID_ADDITIONAL_ASSISTANT
        );
        const newAddOnSlots = updatedAddOnItem ? updatedAddOnItem.quantity : 0;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            addOnSlots: newAddOnSlots,
            pendingAddOnSlots: null,
          },
        });
      } catch (innerErr) {
        console.error(`Error applying pending downgrade for user ${user.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error('applyPendingDowngrades outer error:', err);
  }
}

// prime on startup and schedule recurring checks
applyPendingDowngrades();
setInterval(applyPendingDowngrades, 1000 * 60 * 30); // every 30 minutes

async function applyPendingPlanChanges() {
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const users = await prisma.user.findMany({
      where: {
        pendingPlan: { not: null },
        stripeSubscriptionId: { not: null },
      },
    });

    const priceIdMap = {
      basic: process.env.PRICE_ID_BASIC,
      gold: process.env.PRICE_ID_GOLD,
      platinum: process.env.PRICE_ID_PLATINUM,
    };

    const basePlanLimitMap = {
      basic: 1,
      gold: 1,
      platinum: 1,
    };

    for (const user of users) {
      try {
        if (!user.pendingPlan) continue;
        const targetPlan = user.pendingPlan.toLowerCase();
        const newPriceId = priceIdMap[targetPlan];
        if (!newPriceId) continue;

        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId, {
          expand: ['items'],
        });

        // Only apply at period end
        const periodEnd = subscription.current_period_end;
        if (!periodEnd || nowSec < periodEnd) continue;

        const additionalAssistantPriceId = process.env.PRICE_ID_ADDITIONAL_ASSISTANT;
        const planItem = subscription.items.data.find(
          item => item.price.id !== additionalAssistantPriceId
        );
        if (!planItem) continue;

        // Apply downgrade now (no proration)
        await stripe.subscriptionItems.update(planItem.id, {
          price: newPriceId,
          proration_behavior: 'none',
        });

        // Update user record to reflect new plan
        await prisma.user.update({
          where: { id: user.id },
          data: {
            plan: targetPlan.toUpperCase(),
            basePlanLimit: basePlanLimitMap[targetPlan] ?? user.basePlanLimit,
            pendingPlan: null,
          },
        });
      } catch (innerErr) {
        console.error(`Error applying pending plan change for user ${user.id}:`, innerErr);
      }
    }
  } catch (err) {
    console.error('applyPendingPlanChanges outer error:', err);
  }
}

// Run once on startup and then periodically
applyPendingPlanChanges();
setInterval(applyPendingPlanChanges, 1000 * 60 * 30); // every 30 minutes


app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));