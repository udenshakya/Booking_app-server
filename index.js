const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const UserModel = require("./models/user");
require("dotenv").config();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const imagedownloader = require("image-downloader");
const multer = require("multer");
const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = "awdawdawdawdawddsvds";
const fs = require("fs");
const PlaceModel = require("./models/place");
const BookingModel = require("./models/booking");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

app.use(cors())

mongoose.connect(process.env.MONGO_URL);

app.get("/test", (req, res) => {
    res.json("wdawdaw ok");
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const userDoc = await UserModel.create({
            name,
            email,
            password: bcrypt.hashSync(password, bcryptSalt),
        });
        res.json(userDoc);
    } catch (error) {
        res.status(422).json({ error: error.message || "Registration failed" });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const userDoc = await UserModel.findOne({ email });
        if (userDoc) {
            const passOk = bcrypt.compareSync(password, userDoc.password);

            if (passOk) {
                jwt.sign(
                    { email: userDoc.email, id: userDoc._id },
                    jwtSecret,
                    {},
                    (err, token) => {
                        if (err) throw err;
                        res.cookie("token", token).json(userDoc);
                    }
                );
            } else {
                res.status(422).json("Password not valid");
            }
        } else {
            res.status(404).json("User not found");
        }
    } catch (error) {
        res.status(500).json({ error: error.message || "Login failed" });
    }
});

app.get("/profile", (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            const { name, email, _id } = await UserModel.findById(userData.id);
            res.json({ name, email, _id });
        });
    } else {
        res.json(null);
    }
});

app.post("/logout", (req, res) => {
    res.cookie("token", "").json(true);
});

app.post("/upload-by-link", async (req, res) => {
    try {
        const { link } = req.body;
        const newName = "photo" + Date.now() + ".jpg";
        await imagedownloader.image({
            url: link,
            dest: __dirname + "/uploads/" + newName,
        });
        res.json(newName);
    } catch (error) {
        res.status(500).json({ error: error.message || "Image download failed" });
    }
});

const photosMiddleware = multer({ dest: "uploads/" });
app.post("/upload", photosMiddleware.array("photos", 100), (req, res) => {
    try {
        const uploadedFiles = [];
        for (let i = 0; i < req.files.length; i++) {
            const { path, originalname } = req.files[i];
            const parts = originalname.split(".");
            const ext = parts[parts.length - 1];
            const newPath = path + "." + ext;
            fs.renameSync(path, newPath);
            uploadedFiles.push(newPath.replace("uploads\\", ""));
        }
        res.json(uploadedFiles);
    } catch (error) {
        res.status(500).json({ error: error.message || "File upload failed" });
    }
});

app.post("/places", async (req, res) => {
    try {
        const { token } = req.cookies;
        const {
            title,
            address,
            addedPhotos,
            description,
            perks,
            extraInfo,
            checkIn,
            checkOut,
            maxGuests,
            price
        } = req.body;
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            const placeDoc = await PlaceModel.create({
                owner: userData.id,
                title,
                address,
                photos: addedPhotos,
                description,
                perks,
                extraInfo,
                checkIn,
                checkOut,
                maxGuests,
                price
            });
            res.json(placeDoc);
        });
    } catch (error) {
        res.status(500).json({ error: error.message || "Place creation failed" });
    }
});

app.get("/places", async (req, res) => {
    try {
        const { token } = req.cookies;
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            const { id } = userData;
            const placeDoc = await PlaceModel.find({ owner: id });
            res.json(placeDoc);
        });
    } catch (error) {
        res.status(500).json({ error: error.message || "Error fetching places" });
    }
});

app.get("/places/:id", async (req, res) => {
    try {
        const { id } = req.params;
        res.json(await PlaceModel.findById(id));
    } catch (error) {
        res.status(500).json({ error: error.message || "Error fetching place by ID" });
    }
});

app.put("/places", async (req, res) => {
    try {
        const { token } = req.cookies;
        const {
            id,
            title,
            address,
            addedPhotos,
            description,
            perks,
            extraInfo,
            checkIn,
            checkOut,
            maxGuests,
            price
        } = req.body;
        jwt.verify(token, jwtSecret, {}, async (err, userData) => {
            if (err) throw err;
            const placeDoc = await PlaceModel.findById(id);
            if (userData.id === placeDoc.owner.toString()) {
                placeDoc.set({
                    title,
                    address,
                    photos: addedPhotos,
                    description,
                    perks,
                    extraInfo,
                    checkIn,
                    checkOut,
                    maxGuests,
                    price
                });
            }
            await placeDoc.save();
            res.json("ok");
        });
    } catch (error) {
        res.status(500).json({ error: error.message || "Error updating place" });
    }
});

app.get('/allPlaces', async (req, res) => {
    try {
        const placeDoc = await PlaceModel.find();
        res.json(placeDoc);
    } catch (error) {
        res.status(500).json({ error: error.message || "Error fetching all places" });
    }
});

function getUserDataFromToken(req) {
    return new Promise((resolve, reject) => {
        const token = req.cookies.token;
        if (!token) {
            reject(new Error('Login first'));
        } else {
            jwt.verify(token, jwtSecret, {}, async (err, userData) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(userData);
                }
            });
        }
    });
}


app.post('/bookings', async (req, res) => {
    try {
        const userData = await getUserDataFromToken(req);
        const { place, checkIn, checkOut, numberOfGuests, name, phone, price } = req.body;
        const bookingData = await BookingModel.create({
            place, checkIn, checkOut, numberOfGuests, name, phone, price, user: userData.id
        });
        res.json(bookingData);
    } catch (error) {
        res.status(500).json({ error: error.message || "Error creating booking" });
    }
});

app.get('/bookings', async (req, res) => {
    try {
        const userData = await getUserDataFromToken(req);
        res.json(await BookingModel.find({ user: userData.id }).populate('place'));
    } catch (error) {
        res.status(500).json({ error: error.message || "Error fetching bookings" });
    }
});

app.listen(4000, () => {
    console.log("Server is running on port 4000");
});





