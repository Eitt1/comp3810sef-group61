const express = require('express');
const app = express();
const fs = require('node:fs/promises');
const formidable = require('express-formidable');
const { MongoClient, ObjectId } = require("mongodb");
const session = require('express-session');
const passport = require('passport');
const FacebookStrategy = require('passport-facebook').Strategy;

// Passport & Session Configuration
app.use(session({
    secret: "MediaCloudSecretKey", 
    resave: true,
    saveUninitialized: true
}));

// Initialization
app.use(passport.initialize());
app.use(passport.session());

// Facebook author
const facebookAuth = {
    'clientID': '1766188204082893', 
    'clientSecret': '2351389a4dcb6c4f5240ee82f89de302', 
    'callbackURL': 'https://comp3810sef-group61.onrender.com/auth/facebook/callback'
};


// Serialize user
passport.serializeUser(function (user, done) {
    done(null, user);
});
passport.deserializeUser(function (obj, done) {
    done(null, obj);
});
// Facebook Login Policy
passport.use(new FacebookStrategy({
    clientID: facebookAuth.clientID,
    clientSecret: facebookAuth.clientSecret,
    callbackURL: facebookAuth.callbackURL,
    profileFields: ['id', 'displayName', 'photos'] 
}, function (token, refreshToken, profile, done) {
    // Build user objects
    const user = {
        id: profile.id,
        name: profile.displayName,
        photo: profile.photos ? profile.photos[0].value : null, 
        type: 'facebook'
    };
    return done(null, user);
}));

// Middleware
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));

app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});

// use formidable to handle data
app.use(formidable());

// Database configuration
// Connect to mongodb database
const mongourl = 'mongodb+srv://heying:fjk12380@cluster0.zrabk1y.mongodb.net/media_cloud?retryWrites=true&w=majority';
const client = new MongoClient(mongourl);
const dbName = 'media_cloud';
const collectionName = "media_files";

const getDB = async () => {
    if (!client.topology || !client.topology.isConnected()) {
        await client.connect();
    }
    return client.db(dbName);
};

// Routing logic 

//restful api (No authentication required)

//1. GET (read all data) 
app.get('/api/files', async (req, res) => {
    const db = await getDB();
    const query = {};
    if (req.query.filename) {
        query.filename = { $regex: req.query.filename, $options: 'i' };
    }
    // Query all documents that meet the specified criteria from the collection and convert them into an array.
    const result = await db.collection(collectionName).find(query).toArray();
    res.status(200).json(result);
});

// 2. POST (create a new file)
app.post('/api/files', async (req, res) => {
    const db = await getDB();
    try {
        // Create a new document object using form fields or default values.
        const newDoc = {
            filename: req.fields.filename || 'Untitled', // set filename,defaulting to “Untitled”
            description: req.fields.description || '', // set description ,defauliting to empty
            createdAt: new Date()
        };
        // Insert a new document into the collection
        const result = await db.collection(collectionName).insertOne(newDoc);
        // return create messagea
        res.status(201).json({ message: 'Created', id: result.insertedId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. PUT (update)
app.put('/api/files/:id', async (req, res) => {
    const db = await getDB();
    try {
        const { id } = req.params; // Extract the file id from the url parameters
        // Construct the fields to be updated
        const updateData = {
            $set: {
                filename: req.fields.filename,
                description: req.fields.description,
                updatedAt: new Date()
            }
        };
        // Update documents in the collection based on id
        const result = await db.collection(collectionName).updateOne(
            { _id: new ObjectId(id) },
            updateData
        );
        res.status(200).json({ message: 'Updated', modified: result.modifiedCount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE(delete file)
app.delete('/api/files/:id', async (req, res) => {
    const db = await getDB();
    try {
        const { id } = req.params;
        // Delete documents from a collection based on their id
        const result = await db.collection(collectionName).deleteOne({ _id: new ObjectId(id) });
        res.status(200).json({ message: 'Deleted', deleted: result.deletedCount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Login check.
function isloggedin(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    // Not logged in. Forced redirection to login page.
    res.redirect('/login');
}

// Auth routes 
app.get("/auth/facebook", passport.authenticate("facebook"));

app.get("/auth/facebook/callback",
    passport.authenticate("facebook", { 
        failureRedirect: "/login"
    }),
    function(req, res) {
        // Successful authentication
        res.redirect("/list");
    }
);

app.get("/logout", (req, res, next) => {
    req.logout(function(err) { // Call the logout method of passport
        if (err) { return next(err); }
        res.redirect('/login'); // Return to the login page
    });
});


app.get('/login', (req, res) => {
    // If the user is already logged in, redirect directly to the list page.
    if (req.isAuthenticated()) {
        return res.redirect('/list');
    }
    res.render('login');
});

// Web routes

// 1. Login page
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect('/list');
    } else {
        res.redirect('/login');
    }
});

// 2. the main page
app.get('/list', isloggedin, async (req, res) => {
    const db = await getDB();
    // Query all documents in the collection
    const result = await db.collection(collectionName).find({}).toArray();
    // Load list page and pass in the file array
    res.render('list', { files: result });
});

app.get('/create', isloggedin, (req, res) => {
    res.render('create');
});

// 3. create page
app.post('/create', isloggedin, async (req, res) => {
    const db = await getDB();
     // Construct a new document object
    let newDoc = {
        filename: req.fields.filename || 'Notdefine',  
        description: req.fields.description || '', 
        uploadedAt: new Date(),
        uploader: req.user.name 
    };

    // If the user uploads a file and the file size is more than 0
    if (req.files.filetoupload && req.files.filetoupload.size > 0) {
        const data = await fs.readFile(req.files.filetoupload.path);  // Read the contents of the uploaded file
        const ext = req.files.filetoupload.name.split('.').pop().toLowerCase();  // Get the file extension
        newDoc.mimetype = (ext === 'mp3') ? 'audio/mpeg' : (ext === 'mp4' ? 'video/mp4' : 'application/octet-stream');  //   Set MIME type based on file extension
        newDoc.file = Buffer.from(data).toString('base64');    // Convert file content to a Base64-encoded string and store it in the database
    }
    // Insert a new document into the collection
    await db.collection(collectionName).insertOne(newDoc);
    res.redirect('/list');
});

// 4. details information page
app.get('/details', isloggedin, async (req, res) => {
    const db = await getDB();
    try {
         // Retrieve the document by its _id from the query parameters in the URL.
        const doc = await db.collection(collectionName).findOne({ _id: new ObjectId(req.query._id) });
          // If the document is found, render the edit page; otherwise, display the “File not found” message.
        doc ? res.render('details', { file: doc }) : res.render('info', { message: 'File not found' });
    } catch (e) {
        res.render('info', { message: 'Invalid ID' });
    }
});

// 5. edit file page
app.get('/edit', isloggedin, async (req, res) => {
    const db = await getDB();
    try {
        const doc = await db.collection(collectionName).findOne({ _id: new ObjectId(req.query._id) });
        doc ? res.render('edit', { file: doc }) : res.render('info', { message: 'File not found' });
    } catch (e) {
        res.render('info', { message: 'Invalid ID' });
    }
});

// 6. upadate page
app.post('/update', isloggedin, async (req, res) => {
    const db = await getDB();
    // Construct the fields to be updated
    const updateDoc = {
        filename: req.fields.filename,
        description: req.fields.description,
        updatedAt: new Date()
    };

    if (req.files.filetoupload && req.files.filetoupload.size > 0) {
        const data = await fs.readFile(req.files.filetoupload.path);
        const ext = req.files.filetoupload.name.split('.').pop().toLowerCase();
        updateDoc.mimetype = (ext === 'mp3') ? 'audio/mpeg' : 'video/mp4';
        updateDoc.file = Buffer.from(data).toString('base64');
    }

    try {
        await db.collection(collectionName).updateOne({ _id: new ObjectId(req.fields._id) }, { $set: updateDoc });
        res.redirect(`/details?_id=${req.fields._id}`);
    } catch (e) {
        res.render('info', { message: 'Update failed' });
    }
});

// 6. delete page
app.get('/delete', isloggedin, async (req, res) => {
    const db = await getDB();
    try {
        const doc = await db.collection(collectionName).findOne({ _id: new ObjectId(req.query._id) });
        doc ? res.render('delete', { file: doc }) : res.render('info', { message: 'File not found' });
    } catch (e) {
        res.render('info', { message: 'Invalid ID' });
    }
});

// delete logic 
app.post('/delete', isloggedin, async (req, res) => {
    const db = await getDB();
    try {
        // Delete documents from the collection based on the id.
        await db.collection(collectionName).deleteOne({ _id: new ObjectId(req.fields._id) });
          // Redirect to the file list page after successful deletion
        res.redirect('/list');
    } catch (e) {
        res.render('info', { message: 'Delete failed' });
    }
});

// All unmatched routes are redirected to the root route.
app.get(/(.*)/, (req, res) => {
    res.redirect('/');
});


const port = process.env.PORT || 8099;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));













