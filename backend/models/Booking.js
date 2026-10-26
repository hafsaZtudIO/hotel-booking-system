import mongoose from "mongoose";


const bookingSchema = new mongoose.Schema({

    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Customer",
        required: true
    },


    room: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Room",
        required: true
    },


    checkIn: {
        type: Date,
        required: true
    },


    checkOut: {
        type: Date,
        required: true
    },


    totalPrice: {
        type: Number,
        required: true
    },


    status: {
        type: String,
        enum: [
            "Booked",
            "Checked In",
            "Checked Out",
            "Cancelled"
        ],
        default: "Booked"
    }


}, {
    timestamps: true
});


export default mongoose.model("Booking", bookingSchema);