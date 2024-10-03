const express = require('express')
const env = require('dotenv').config();
const db = require('../config/db')
const bcrypt = require('bcrypt')
const crypto = require('crypto');
const nodemailer = require('nodemailer')
const axios = require('axios');
const dns = require('dns');
const { log } = require('console');
const Razorpay = require('razorpay');
const { RAZORPAY_ID_KEY, RAZORPAY_SECRET_KEY } = process.env;

const razorpayInstance = new Razorpay({
  key_id: RAZORPAY_ID_KEY,
  key_secret: RAZORPAY_SECRET_KEY
});


const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

const loadHome = (req, res, next) => {
  try {
    res.render('home')
  } catch (error) {
    console.log(error.message);

  }
}
const loadLitePlan = (req, res, next) => {
  try {
    res.render('liteplan')
  } catch (error) {
    console.log(error.message);

  }
}
const loadHeroPlan = (req, res, next) => {
  try {
    res.render('heroplan')
  } catch (error) {
    console.log(error.message);

  }
}
const loadProPlan = (req, res, next) => {
  try {
    res.render('proplan')
  } catch (error) {
    console.log(error.message);

  }
}
const loadFAQ = (req, res, next) => {
  try {
    res.render('faq')
  } catch (error) {
    console.log(error.message);

  }
}
const loadContact = (req, res, next) => {
  try {
    res.render('contact')
  } catch (error) {
    console.log(error.message);

  }
}

const loadAbout = (req, res, next) => {
  try {
    res.render('about')
  } catch (error) {
    console.log(error.message);

  }
}

const loadLogin = (req, res, next) => {
  try {
    res.render('login', { message: '' })
  } catch (error) {
    console.log(error.message);

  }
}

const loadSignup = (req, res, next) => {
  try {
    res.render('signup', { message: '' })
  } catch (error) {
    console.log(error.message);

  }
}
const loadSignout = (req, res, next) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error while signing out:', err);
        return res.status(500).send('Error occurred during signout.');
      }

      // Clear the cookie
      res.clearCookie('connect.sid'); // This clears the session ID cookie
      res.redirect('/login'); // Redirect to login page or any other page after signout
    });
  } catch (error) {
    console.log(error.message);

  }
}

const signup = async (req, res) => {
  const { name, phone, email, password, confirmPassword } = req.body;

  // Basic validation
  if (!name || !phone || !email || !password || !confirmPassword) {
    return res.status(400).render('signup', { message: 'All fields are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).render('signup', { message: 'Passwords do not match.' });
  }

  try {
    // Check if user already exists
    const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
      return res.status(400).render('signup', { message: 'User already exists.' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Insert the user into the database
    const result = await db.query(
      'INSERT INTO users (name, phone, email, password, verificationToken, verified) VALUES (?, ?, ?, ?,?, ?)',
      [name, phone, email, hashedPassword, verificationToken, false]
    );

    // Send verification email
    const verificationLink = `${process.env.BASE_URL}/verify-email?token=${verificationToken}&email=${email}`;

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: 'Email Verification - Shop2Host',
      html: `<p>Hi ${name},</p>
               <p>Thank you for registering. Please verify your email by clicking the link below:</p>
               <a href="${verificationLink}">Verify Email</a>`,
    };

    await transporter.sendMail(mailOptions);
    // Check if there's an original URL to redirect to
    const redirectUrl = req.session.originalUrl || '/dashboard'; // Default to dashboard if no original URL

    // Clear the original URL from the session after redirection
    delete req.session.originalUrl;

    res.status(201).render('login', { message: 'Registration successful! Please check your email to verify your account.' })
  } catch (error) {
    console.error('Error during user registration:', error);
    res.status(500).render('signup', { message: 'An error occurred while registering the user.' });
  }
}

const login = async (req, res, next) => {
  const { email, password } = req.body;

  // Basic validation
  if (!email || !password) {
    return res.status(400).render('login', { message: 'Email and Password are required.' });
  }

  try {
    // Check if user exists and is verified
    const [user] = await db.query('SELECT * FROM users WHERE email = ? AND verified = ?', [email, true]);
    if (user.length === 0) {
      return res.status(400).render('login', { message: 'User not found or Email not verified.' });
    }

    const existingUser = user[0];

    // Compare the password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(400).render('login', { message: 'Incorrect Email or password.' });
    }

    // Set user session
    req.session.user_id = existingUser.id;

    // Check if there’s an original URL stored in the session
    const redirectUrl = req.session.originalUrl || '/dashboard'; // Redirect to original URL or default to dashboard
    console.log(req.session.originalUrl);

    // Clear the original URL after use
    delete req.session.originalUrl;

    // Redirect to the intended page or dashboard
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error during user login:', error);
    res.status(500).render('login', { message: 'An error occurred while logging in.' });
  }
};


const verifyEmail = async (req, res) => {
  const { token, email } = req.query;

  if (!token || !email) {
    return res.status(400).send('Invalid request.');
  }

  try {
    // Check if user exists with the provided email and token
    const [user] = await db.query('SELECT * FROM users WHERE email = ? AND verificationToken = ?', [email, token]);
    if (user.length === 0) {
      return res.status(400).send('Invalid token or email.');
    }

    // Update user's verified status to true and remove the verification token
    await db.query('UPDATE users SET verified = ?, verificationToken = ? WHERE email = ?', [true, null, email]);

    res.status(200).render('login', { message: 'Email verification successful! You can now log in.' });
  } catch (error) {
    console.error('Error during email verification:', error);
    res.status(500).send('An error occurred during email verification.');
  }
};

const loadTC = (req, res) => {
  try {
    res.render('TC')
  } catch (error) {
    console.log(error.message);

  }
}

const privacyPolicy = (req, res) => {
  try {
    res.render('privacyPolicy')
  } catch (error) {
    console.log(error.message);

  }
}

const loadDashboard = async (req, res) => {
  const userId = req.session.user_id || req.user.id; // Assuming you have user ID in session
  let stores = [];

  try {
      const [rows] = await db.query(`
          SELECT 
              s.id AS store_id,
              s.name AS store_name,
              s.logo AS store_logo,
              COUNT(o.id) AS total_orders
          FROM 
              stores s
          LEFT JOIN 
              orders o ON s.id = o.store_id AND o.user_id = ?
          WHERE 
              s.user_id = ?
          GROUP BY 
              s.id, s.name, s.logo
      `, [userId, userId]); // Assuming stores are linked to users by user_id

      stores = rows; 

      res.render('dashboard', { stores });
  } catch (error) {
      console.error('Error fetching stores:', error);
      res.render('dashboard', { stores: [] });
  }
}

const loadCreateStore = (req, res) => {
  try {
    const selectedPlan = req.query.plan;
    const amount = req.query.amount;

    req.session.plan = selectedPlan;
    req.session.amount = amount;
    res.render('create-store')
  } catch (error) {
    console.log(error.message);

  }
}

const loadStoreDetails = (req, res) => {
  try {
    res.render('store-details')
  } catch (error) {
    console.log(error.message);

  }
}

const loadFindDomain = (req, res) => {
  try {
    res.render('find-domain', { selectedPlan: req.session.plan, message: '', isAvailable: false })
  } catch (error) {
    console.log(error.message);

  }
}

const loadBusinessEmail = (req, res) => {
  try {
    res.render('business-email', { selectedDomain: req.session.selectedDomain })
  } catch (error) {
    console.log(error.message);

  }
}

const loadPricingPlan = (req, res) => {
  try {
    res.render('pricing-plan')
  } catch (error) {
    console.log(error.message);

  }
}

// In createStore function
const createStore = async (req, res) => {
  const { productType, experience, productCount } = req.body;

  // Basic validation
  if (!productType || !experience || !productCount) {
    return res.status(400).render('create-store', { message: 'All fields are required.' });
  }

  try {
    // Initialize storeDetails if it doesn't exist
    if (!req.session.storeDetails) {
      req.session.storeDetails = {}; // Create the object if it doesn't exist
    }

    // Combine details in session
    req.session.storeDetails.productInfo = {
      productType,
      experience,
      productCount
    };

    // Redirect to the next step (e.g., store details)
    res.redirect('/store-details');
  } catch (error) {
    console.error('Error saving store info in session:', error);
    res.status(500).render('create-store', { message: 'An error occurred while saving your details.' });
  }
}

// In storeDetails function
const storeDetails = async (req, res) => {
  const { storeName, address, email, phone, whatsapp } = req.body;
  const logo = req.file ? req.file.filename : null;

  // Basic validation
  if (!storeName || !address || !email || !phone || !whatsapp) {
    return res.status(400).render('store-details', { message: 'All fields are required.' });
  }

  try {
    // Initialize storeDetails if it doesn't exist
    if (!req.session.storeDetails) {
      req.session.storeDetails = {}; // Create the object if it doesn't exist
    }

    // Combine details in session
    req.session.storeDetails.details = {
      userId: req.session.user_id || req.user.id,
      name: storeName,
      logo: logo,
      address: address,
      email: email,
      phone: phone,
      whatsapp: whatsapp
    };

    // Redirect to the next step (e.g., domain availability check)
    res.redirect('/find-domain');
  } catch (error) {
    console.error('Error saving store details in session:', error);
    res.status(500).render('store-details', { message: 'An error occurred while saving your details.' });
  }
}

const findDomain = async (req, res) => {
  const { domainName } = req.body;
  const selectedPlan = req.session.plan;
  const fullDomain = selectedPlan === 'lite' ? `${domainName}.in` : `${domainName}.com`;

  let isAvailable = false;

  if (fullDomain) {
    dns.lookup(fullDomain, (err) => {
      if (err) {
        // Domain is available
        isAvailable = true;
      }

      // Respond with JSON data for front-end handling
      res.json({ isAvailable });
    });
  } else {
    res.status(400).json({ message: "Please enter a valid domain name." });
  }
}

const saveNewDomain = async (req, res) => {
  const { domainName } = req.body;
  const selectedPlan = req.session.plan;
  const fullDomain = selectedPlan === 'lite' ? `${domainName}.in` : `${domainName}.com`;

  try {
    if (!req.session.storeDetails) {
      req.session.storeDetails = {}; // Create the object if it doesn't exist
    }
    req.session.storeDetails.selectedDomain = fullDomain;
    res.status(200).json({ message: 'Domain saved successfully!' });
  } catch (error) {
    console.error('Error saving new domain:', error);
    res.status(500).json({ message: 'An error occurred while saving your new domain.' });
  }
}

const existingDomain = async (req, res) => {
  const { existingDomainName } = req.body;
  try {
    if (!req.session.storeDetails) {
      req.session.storeDetails = {}; // Create the object if it doesn't exist
    }
    req.session.storeDetails.selectedDomain = existingDomainName;
    res.redirect('/business-email');
  } catch (error) {
    console.error('Error saving existing domain:', error);
    res.render('find-domain', {
      message: 'An error occurred while saving your existing domain.',
      isAvailable: false,
      selectedPlan: req.session.plan
    });
  }
}

const saveBusinessEmail = async (req, res) => {
  const { subdomain } = req.body;
  if (!req.session.storeDetails) {
    req.session.storeDetails = {}; // Create the object if it doesn't exist
  }
  const selectedDomain = req.session.storeDetails.selectedDomain || 'shop2host.com'; // Fallback domain if not set
  const fullEmail = `${subdomain}@${selectedDomain}`;

  req.session.storeDetails.businessEmail = fullEmail;

  res.redirect('/ecommerce-demo');
}

const loadEcommerceDemo = async (req, res) => {
  let storeData;

  try {
    // Check if store details are available in the session
    if (req.session.storeDetails && req.session.storeDetails.details) {
      // Use data from session
      const details = req.session.storeDetails.details;
      storeData = {
        name: details.name || 'Sample Store', // Fallback name
        logo: details.logo || 'logo.png', // Fallback logo
        phone: details.phone || '123-456-7890', // Fallback contact number
        email: details.email || 'info@samplestore.com', // Fallback email
        address: details.address
      };
    } else {
      // Default sample data if no session data is available
      storeData = {
        name: 'Sample Store',
        logo: 'logo.png', // Dummy logo
        phone: '123-456-7890',
        email: 'info@samplestore.com',
        address: '123 Sample St, Sample City'
      };
    }

    // Render the e-commerce index page with the store data
    res.render('ecommerce-demo', { store: storeData, layout: false });
  } catch (error) {
    console.error('Error fetching store data:', error);
    // Render with default sample data in case of error
    res.render('ecommerce-demo', {
      store: {
        name: 'Sample Store',
        logo: 'logo.png',
        phone: '123-456-7890',
        email: 'info@samplestore.com',
        address: '123 Sample St, Sample City'
      }
    });
  }
}

const loadBilling = (req, res) => {
  try {
    res.render('billing')
  } catch (error) {
    console.log(error.message);

  }
}

const loadOpenTicket = (req, res) => {
  try {
    res.render('open-ticket')
  } catch (error) {
    console.log(error.message);

  }
}

const loadSupport = (req, res) => {
  try {
    res.render('view-ticket')
  } catch (error) {
    console.log(error.message);

  }
}

const loadStoreManegment = async (req, res) => {
  const userId = req.session.user_id; // Assuming you have user ID in session
  let stores = [];

  try {
    // Fetch user's stores from the database
    const [rows] = await db.query('SELECT * FROM stores WHERE user_id = ?', [userId]);
    stores = rows; // Store the retrieved stores

    // Render the dashboard with store data
    res.render('store-management', { stores });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.render('store-management', { stores: [] }); // Render with empty array on error
  }
}

const saveBillingDetails = (req, res) => {
  try {
    const { name, email, phone, address, state, country, pin_code } = req.body;

    // Initialize storeDetails if it doesn't exist
    if (!req.session.storeDetails) {
      req.session.storeDetails = {}; // Create the object if it doesn't exist
    }

    // Save billing details in session
    req.session.storeDetails.billingDetails = {
      name,
      email,
      phone,
      address,
      state,
      country,
      pin_code
    };

    // Send a structured JSON response back to the client
    res.status(200).json({ success: true, msg: 'Billing details saved successfully.' });
  } catch (error) {
    console.error('Error saving billing details:', error.message); // Log the error message
    res.status(500).json({ success: false, msg: 'Failed to save billing details.' }); // Send error response
  }
};

const createOrder = async (req, res) => {
  try {
    // Extract necessary details from session
    const { amount } = req.session; // Assuming amount is already in paise
    const { name, email, phone } = req.session.storeDetails.billingDetails; // Corrected to access billing details from storeDetails
    const { productInfo, details } = req.session.storeDetails;

    // Set up the order options for Razorpay
    const options = {
      amount: amount * 100, // Convert to paise if needed
      currency: 'INR',
      receipt: `receipt#${Date.now()}`, // Unique receipt ID
      notes: {
        productType: productInfo.productType,
        experience: productInfo.experience,
        productCount: productInfo.productCount,
        userId: details.userId,
        storeName: details.name,
        address: details.address,
        email: email,
        phone: phone,
        whatsapp: details.whatsapp
      }
    };

    // Create an order with Razorpay
    razorpayInstance.orders.create(options, (err, order) => {
      if (!err) {
        // Send a successful response back to the client
        res.status(200).json({
          success: true,
          msg: 'Order Created',
          order_id: order.id,
          amount: options.amount,
          key_id: RAZORPAY_ID_KEY, // Your Razorpay key ID
          product_name: productInfo.productType, // Example product name
          description: `Order for ${details.name}`, // Example description
          contact: phone,
          email: email
        });
      } else {
        // Handle errors during order creation
        console.error('Razorpay Order Creation Error:', err);
        res.status(400).json({ success: false, msg: 'Something went wrong!' });
      }
    });
  } catch (error) {
    console.error('Error creating order:', error.message);
    res.status(500).json({ success: false, msg: 'Internal Server Error' });
  }
};

const paymentSuccess = async (req, res) => {
  const { orderId, paymentId } = req.body;

  // Retrieve billing and store details from session
  const { name, email: billingEmail, phone, address, state, country, pin_code } = req.session.storeDetails.billingDetails; // Accessing billing details
  const { selectedDomain, businessEmail } = req.session.storeDetails; // Accessing store details
  const { productType, experience, productCount } = req.session.storeDetails.productInfo; // Accessing product info
  
  const userId = req.session.user_id || req.user.id; // Accessing user ID
  const plan = req.session.plan; // Accessing plan
  const amount = parseInt(req.session.amount,10) || 0; // Accessing amount

  // Additional details from session
  const { logo, whatsapp } = req.session.storeDetails.details; // Accessing additional details
  const storeName = req.session.storeDetails.details.name; // Accessing store name

  try {
      // Step 1: Insert or get the store ID
      let storeId;
      const [storeRows] = await db.query('SELECT id FROM stores WHERE name = ?', [storeName]);

      if (storeRows.length > 0) {
          // Store exists; use its ID
          storeId = storeRows[0].id;
      } else {
          // Store does not exist; insert it
          const [result] = await db.query(
              'INSERT INTO stores (name, logo, address, email, phone, whatsapp, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [storeName || '', logo || '', address || '', billingEmail || '', phone || '', whatsapp || '', userId]
          );
          storeId = result.insertId; // Get the new store ID
      }


      // Step 2: Save order details into the orders table with user ID
      await db.query(
          'INSERT INTO orders (order_id, payment_id, user_id, store_id, name, email, phone, address, state, country, pin_code, domain_name, business_email, product_type, experience, product_count, plan, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
              orderId,
              paymentId,
              userId || null,         
              storeId,
              name || '',
              billingEmail || '',
              phone || '',
              address || '',
              state || '',
              country || '',
              pin_code || '',
              selectedDomain || '',
              businessEmail || '',
              productType || '',
              experience || '',
              productCount || '',
              plan || '',
              amount
          ]
      );

      // Clear session data if needed or keep it for future reference
      delete req.session.storeDetails;

      res.json({ success: true }); // Send success response back to client
  } catch (error) {
      console.error('Error saving order details:', error); // Log error message for debugging
      res.status(500).json({ success: false }); // Send error response back to client
  }
};


module.exports = {
  loadHome,
  loadLitePlan,
  loadHeroPlan,
  loadProPlan,
  loadFAQ,
  loadContact,
  loadAbout,
  loadLogin,
  loadSignup,
  loadSignout,
  signup,
  login,
  verifyEmail,
  loadTC,
  privacyPolicy,
  loadDashboard,
  loadCreateStore,
  loadStoreDetails,
  loadFindDomain,
  loadBusinessEmail,
  loadPricingPlan,
  createStore,
  storeDetails,
  findDomain,
  saveNewDomain,
  existingDomain,
  saveBusinessEmail,
  loadEcommerceDemo,
  loadBilling,
  loadOpenTicket,
  loadSupport,
  loadStoreManegment,
  saveBillingDetails,
  createOrder,
  paymentSuccess,
}
