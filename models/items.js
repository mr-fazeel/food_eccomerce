const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const itemSchema = new Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: false, // Explicitly state it is optional
    },
    image: {
        url:{
    type: String,
    set: (v) => v == "" ? "https://www.truefoodkitchen.com/wp-content/uploads/2024/09/OLO_Chopped-Salad_2532x1896.jpg" : v,  // Set default image if none provided
}
    },
price: {
    type: Number,
        required: false,  // Optional, but could also specify validation if needed
            min: [0, 'Price must be positive'], // Example validation
    },
});

const Item = mongoose.model("Item", itemSchema);

module.exports = Item;

