const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    cart: [
        {
            itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
            quantity: { type: Number, default: 1 } // Option: to allow multiple quantities
        }
    ]
});
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);

