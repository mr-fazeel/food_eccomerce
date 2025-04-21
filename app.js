require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const ejsMate = require('ejs-mate');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const Item = require('./models/items');
const User = require('./models/user');
const Order = require('./models/order');

const ExpressError = require('./utils/ExpressError.js');
const { saveRedirectUrl } = require('./middleware');
const { isLoggedIn } = require('./middleware');

// MongoDB Connection
const dbUrl = process.env.MONGODB_URL || 'mongodb://127.0.0.1:27017/food';

// Connect to MongoDB
main()
    .then(() => console.log('Connected to DB'))
    .catch((err) => console.log(err));

async function main() {
    await mongoose.connect(dbUrl);
}

// Middleware & Configurations
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.engine('ejs', ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride("_method"));

// Session Configuration
const store = MongoStore.create({
    mongoUrl: dbUrl,
    touchAfter: 24 * 60 * 60, // time period in seconds
    crypto: {
        secret: process.env.SESSION_SECRET
    }
});

const sessionOptions = {
    store,
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    },
};

app.use(session(sessionOptions));
app.use(flash());

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Global Middleware
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currUser = req.user;
    next();
});

// Security Headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// ======================
// Routes
// ======================

// Home Route
app.get('/', async (req, res) => {
    try {
        const allItems = await Item.find();
        const userCart = req.user
            ? await User.findById(req.user._id).populate('cart.itemId').then(user => user.cart)
            : [];
        res.render('foods/index', { allItems, userCart });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// User Routes
app.get('/signup', (req, res) => {
    res.render('./users/signup');
});

app.post('/signup', async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        const newUser = new User({ email, username });
        const registeredUser = await User.register(newUser, password);
        req.login(registeredUser, (err) => {
            if (err) return next(err);
            req.flash('success', 'Welcome to Food App!');
            res.redirect('/');
        });
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/signup');
    }
});

app.get('/login', (req, res) => {
    res.render('./users/login');
});

app.post(
    '/login',
    saveRedirectUrl,
    passport.authenticate('local', {
        failureFlash: true,
        failureRedirect: '/login',
    }),
    (req, res) => {
        req.flash('success', 'Welcome back!');
        const redirectUrl = res.locals.redirectUrl || '/';
        res.redirect(redirectUrl);
    }
);

app.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        req.flash("success", "You're Logged Out!");
        res.redirect('/');
    });
});

// ======================
// Cart Routes (Fixed Order)
// ======================

// Checkout routes FIRST
app.get('/cart/checkout', isLoggedIn, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate('cart.itemId');
        if (!user?.cart) return res.redirect('/cart');
        let subtotal = 0;
        user.cart.forEach(cartItem => subtotal += cartItem.itemId.price * cartItem.quantity);
        res.render('foods/checkout', { subtotal, deliveryCharge: 20 });
    } catch (err) {
        console.error(err);
        res.redirect('/cart');
    }
});

// app.post('/cart/checkout', isLoggedIn, async (req, res) => {
//     const { name, address, phone } = req.body;
//     if (!name || !address || !phone) return res.redirect('/cart/checkout');

//     try {
//         const user = await User.findById(req.user._id).populate('cart.itemId');
//         let totalAmount = 0;
//         const orderItems = user.cart.map(cartItem => {
//             totalAmount += cartItem.itemId.price * cartItem.quantity;
//             return {
//                 name: cartItem.itemId.title,
//                 quantity: cartItem.quantity,
//                 price: cartItem.itemId.price
//             };
//         });
//         await new Order({
//             customerName: name,
//             phone,
//             address,
//             items: orderItems,
//             totalAmount
//         }).save();
//         // Clear the user's cart after order is placed
//         user.cart = [];
//         await user.save();

//         // Retrieve all orders to pass to the order view
//         const orders = await Order.find();
//         return res.render('foods/order', { orders });
//     } catch (err) {
//         console.error(err);
//         return res.redirect('/cart/checkout');
//     }
// });

app.post('/cart/checkout', isLoggedIn, async (req, res) => {
    const { name, address, phone } = req.body;
    if (!name || !address || !phone) return res.redirect('/cart/checkout');

    try {
        const user = await User.findById(req.user._id).populate('cart.itemId');
        let totalAmount = 0;
        const orderItems = user.cart.map(cartItem => {
            totalAmount += cartItem.itemId.price * cartItem.quantity;
            return {
                name: cartItem.itemId.title,
                quantity: cartItem.quantity,
                price: cartItem.itemId.price
            };
        });

        // Create the order with user reference
        const newOrder = new Order({
            customerName: name,
            phone,
            address,
            items: orderItems,
            totalAmount,
            user: req.user._id // Add user ID
        });

        await newOrder.save();

        // Clear the user's cart
        user.cart = [];
        await user.save();

        req.flash('success', 'Order placed successfully!');
        res.redirect('/orders'); // Redirect to orders page
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to place order.');
        res.redirect('/cart/checkout');
    }
});

// View Cart
app.get('/cart', async (req, res) => {
    if (!req.user) {
        req.flash('error', 'You must be logged in to view your cart!');
        return res.redirect('/login');
    }
    const user = await User.findById(req.user._id).populate('cart.itemId');
    res.render('foods/cart', { userCart: user.cart });
});

// Parameterized cart routes AFTER checkout
app.post('/cart/:itemId', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    try {
        const item = await Item.findById(req.params.itemId);
        const user = await User.findById(req.user._id);
        const existingCartItem = user.cart.find(cartItem => cartItem.itemId.equals(req.params.itemId));
        existingCartItem ? existingCartItem.quantity++ : user.cart.push({ itemId: req.params.itemId });
        await user.save();
        req.flash('success', `${item.title} added to cart!`);
        res.redirect('/');
    } catch (error) {
        req.flash('error', 'Failed to add item to cart!');
        res.redirect('/');
    }
});

app.post('/cart/:itemId/remove', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.user._id);
        user.cart = user.cart.filter(cartItem => !cartItem.itemId.equals(req.params.itemId));
        await user.save();
        req.flash('success', 'Item removed from cart!');
        res.redirect('/cart');
    } catch (error) {
        req.flash('error', 'Failed to remove item from cart!');
        res.redirect('/cart');
    }
});

app.post('/cart/:itemId/increase', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.user._id);
        const cartItem = user.cart.find(item => item.itemId.equals(req.params.itemId));
        if (cartItem) cartItem.quantity++;
        await user.save();
        req.flash('success', 'Item quantity increased!');
        res.redirect('/cart');
    } catch (err) {
        req.flash('error', 'Failed to increase quantity!');
        res.redirect('/cart');
    }
});

app.post('/cart/:itemId/decrease', async (req, res) => {
    if (!req.user) return res.redirect('/login');
    try {
        const user = await User.findById(req.user._id);
        const cartItem = user.cart.find(item => item.itemId.equals(req.params.itemId));
        if (cartItem?.quantity > 1) cartItem.quantity--;
        await user.save();
        req.flash('success', 'Item quantity decreased!');
        res.redirect('/cart');
    } catch (err) {
        req.flash('error', 'Failed to decrease quantity!');
        res.redirect('/cart');
    }
});

app.get('/orders', isLoggedIn, async (req, res) => {
    try {
        // Fetch orders for the current user, sorted by latest first
        const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.render('foods/order', { orders });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Failed to retrieve your orders.');
        res.redirect('/');
    }
});

// ======================
// Admin Routes
// ======================
app.get('/admin', async (req, res) => {
    try {
        const allItems = await Item.find();
        res.render('Admin_dashboard/index', { allItems });
    } catch (err) {
        res.status(500).send('Server Error');
    }
});

app.get('/admin/create', (req, res) => res.render('Admin_dashboard/Admin_CRUD/create'));
app.post('/admin/create/item', async (req, res) => {
    await new Item(req.body.item).save();
    req.flash("success", "New Item Added!");
    res.redirect("/admin");
});

app.get('/admin/item/edit/:id', async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        res.render('Admin_dashboard/Admin_CRUD/edit', { item });
    } catch (err) {
        req.flash("error", "Item not found!");
        res.redirect('/admin');
    }
});

app.put('/admin/item/edit/:id', async (req, res) => {
    try {
        await Item.findByIdAndUpdate(req.params.id, req.body.item, { runValidators: true });
        req.flash("success", "Item updated successfully!");
        res.redirect('/admin');
    } catch (err) {
        req.flash("error", "Failed to update the item.");
        res.redirect('/admin');
    }
});

app.delete('/admin/item/delete/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    req.flash("success", "Item Deleted!");
    res.redirect("/admin");
});

// Route to fetch and display orders for the admin
app.get('/admin/order', async (req, res) => {
    try {
        const orders = await Order.find();
        res.render('Admin_dashboard/orders', { orders });
    } catch (err) {
        console.error(err);
        res.status(500).send('Internal Server Error');
    }
});

// Route to update order status

app.post('/admin/orders/update', async (req, res) => {
    try {
        const { orderIds, status } = req.body;

        if (!orderIds || !status) return res.redirect('/admin/order'); // Fix redirect here

        for (let i = 0; i < orderIds.length; i++) {
            await Order.findByIdAndUpdate(orderIds[i], { status: status[i] });
        }

        res.redirect('/admin/order'); // Corrected redirect path
    } catch (err) {
        console.error(err);
        res.status(500).send('Error updating orders');
    }
});

// ======================
// Error Handling
// ======================
app.all('*', (req, res, next) => next(new ExpressError(404, 'Page Not Found')));
app.use((err, req, res, next) => {
    const { statusCode = 500, message = 'Something went wrong!' } = err;
    if (process.env.NODE_ENV === 'production') {
        // Don't expose error details in production
        res.status(statusCode).render('error', { 
            message: statusCode === 500 ? 'Internal Server Error' : message 
        });
    } else {
        // Show detailed errors in development
        res.status(statusCode).render('error', { 
            message,
            stack: err.stack 
        });
    }
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${port}`);
});