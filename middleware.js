const Item = require("./models/items.js");
const ExpressError = require('./utils/ExpressError.js');
// const { listingSchema } = require('./schema.js');
// const { reviewSchema } = require('./schema.js')


module.exports.isLoggedIn = (req, res, next) => {

    if (!req.isAuthenticated()) {
        req.session.redirectUrl = req.originalUrl;
        req.flash("error", "You must be logged in to create items!")
        return res.redirect('/login')
    }
    next();
}

module.exports.saveRedirectUrl = (req, res, next) => {
    if (req.session.redirectUrl) {
        res.locals.redirectUrl = req.session.redirectUrl
    }
    next();
}

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let item = await Item.findById(id);
    if (!item.owner._id.equals(res.locals.currUser._id)) {
        req.flash("error", "You don't have permission to do so...");
        return res.redirect(`/items/${id}`)
    }
    next();
}