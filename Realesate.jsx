import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase config (env variable থেকে নেওয়া ভালো)
// .env.local ফাইলে রাখো, যেমন: REACT_APP_FIREBASE_API_KEY=...
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export default function RealEstateWebsite() {
  const [user, setUser] = useState(null);

  // প্রপার্টিগুলোর তালিকা
  const [properties, setProperties] = useState([]);

  // নতুন প্রপার্টির ডাটা (টাইটেল, প্রাইস, লোকেশন, ছবি)
  const [newProperty, setNewProperty] = useState({
    title: "",
    price: "",
    location: "",
    image: null,
  });

  // ছবি প্রিভিউ দেখানোর জন্য ইউআরএল
  const [imagePreview, setImagePreview] = useState(null);

  // ইউজারের লগইন / সাইনআপ ফর্ম ডাটা
  const [authForm, setAuthForm] = useState({ email: "", password: "" });

  // লগইন না সাইনআপ মোড
  const [mode, setMode] = useState("login");

  // যোগাযোগ ফর্ম ডাটা
  const [contactForm, setContactForm] = useState({ name: "", message: "" });

  // লোডিং স্টেট
  const [loading, setLoading] = useState(false);

  // ত্রুটি বার্তা দেখানোর জন্য
  const [error, setError] = useState("");

  // ইউজারের অটোমেটিক লগইন চেক এবং প্রপার্টি লিস্ট রিয়েল-টাইম
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubProperties = onSnapshot(collection(db, "properties"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProperties(data);
    });

    return () => {
      unsubAuth();
      unsubProperties();
    };
  }, []);

  // ইউজার সাইনআপ / লগইন হ্যান্ডলার
  const handleAuth = async () => {
    setError("");
    if (!authForm.email || !authForm.password) {
      setError("অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // লগআউট ফাংশন
  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      alert("লগআউট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // নতুন প্রপার্টি যোগ করার ফাংশন
  const handleAddProperty = async () => {
    setError("");
    const { title, price, location, image } = newProperty;

    // সহজ ভ্যালিডেশন
    if (!title || !price || !location || !image) {
      setError("সব ফিল্ড অবশ্যই পূরণ করুন।");
      return;
    }

    setLoading(true);
    try {
      // ছবির জন্য রেফারেন্স তৈরি ও আপলোড
      const imageRef = ref(storage, `properties/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);

      // আপলোডকৃত ছবির URL নিন
      const imageUrl = await getDownloadURL(imageRef);

      // ফায়ারস্টোরে নতুন ডকুমেন্ট যোগ করুন
      await addDoc(collection(db, "properties"), {
        title,
        price,
        location,
        image: imageUrl,
        createdBy: user.email,
        createdAt: serverTimestamp(),
      });

      // ফরম রিসেট
      setNewProperty({ title: "", price: "", location: "", image: null });
      setImagePreview(null);
    } catch (err) {
      setError("প্রপার্টি যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // প্রপার্টি মুছে ফেলার ফাংশন
  const handleDeleteProperty = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে প্রপার্টি মুছে ফেলতে চান?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "properties", id));
    } catch (err) {
      alert("প্রপার্টি মুছে ফেলতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // যোগাযোগ ফর্ম সাবমিট
  const handleContactSubmit = async () => {
    setError("");
    if (!contactForm.name || !contactForm.message) {
      setError("আপনার নাম ও বার্তা অবশ্যই দিন।");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "contacts"), {
        ...contactForm,
        submittedAt: serverTimestamp(),
      });
      alert("বার্তা সফলভাবে পাঠানো হয়েছে!");
      setContactForm({ name: "", message: "" });
    } catch (err) {
      alert("বার্তা পাঠাতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // ছবি ফাইল সিলেক্ট করলে প্রিভিউ দেখানোর জন্য
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProperty({ ...newProperty, image: file });

      // প্রিভিউ জন্য URL তৈরি
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setNewProperty({ ...newProperty, image: null });
      setImagePreview(null);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="p-6"
    >
      <motion.h1 className="text-3xl font-bold text-green-600" variants={fadeInUp}>
        মকান
      </motion.h1>

      {loading && (
        <motion.p
          className="text-sm text-center my-2 text-blue-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          প্রক্রিয়াজাত হচ্ছে...
        </motion.p>
      )}

      {error && (
        <motion.p
          className="text-sm text-center my-2 text-red-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}

      {!user ? (
        <motion.div
          className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow"
          variants={fadeInUp}
        >
          <h2 className="text-xl font-bold mb-4 text-center">
            {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
          </h2>

          <input
            type="email"
            placeholder="ইমেইল"
            className="border p-2 w-full mb-2"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="পাসওয়ার্ড"
            className="border p-2 w-full mb-4"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          />

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAuth} disabled={loading} className="w-full mb-2">
              {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
            </Button>
          </motion.div>

          <p className="text-sm text-center">
            {mode === "signup" ? "আগেই একাউন্ট আছে?" : "একাউন্ট নেই?"}{" "}
            <span
              className="text-green-600 cursor-pointer"
              onClick={() => {
                setError("");
                setMode(mode === "signup" ? "login" : "signup");
              }}
            >
              {mode === "signup" ? "লগ ইন করুন" : "সাইন আপ করুন"}
            </span>
          </p>
        </motion.div>
      ) : (
        <motion.div className="my-4 space-x-2 text-right" variants={fadeInUp}>
          <span className="text-green-600">স্বাগতম, {user.email}</span>
          <Button onClick={handleLogout} disabled={loading}>
            লগ আউট
          </Button>
        </motion.div>
      )}

      {user && (
        <motion.div className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow" variants={fadeInUp}>
          <h2 className="text-xl font-semibold mb-2">নতুন প্রপার্টি যোগ করুন</h2>

          <input
            type="text"
            placeholder="শিরোনাম"
            value={newProperty.title}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, title: e.target.value })}
          />

          <input
            type="text"
            placeholder="দাম"
            value={newProperty.price}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, price: e.target.value })}
          />

          <input
            type="text"
            placeholder="অবস্থান"
            value={newProperty.location}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, location: e.target.value })}
          />

          <input type="file" className="block my-2" onChange={handleImageChange} />

          {imagePreview && (
            <img
              src={imagePreview}
              alt="ছবির প্রিভিউ"
              className="w-48 h-32 object-cover rounded my-2"
            />
          )}

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAddProperty} disabled={loading}>
              প্রপার্টি জমা দিন
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* প্রপার্টি গুলো দেখানোর অংশ */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <AnimatePresence>
          {properties.map((property) => (
            <motion.div
              key={property.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="hover:shadow-xl transition">
                <CardContent>
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={property.image}
                    alt={property.title}
                    className="rounded mb-2"
                  />
                  <h3 className="text-lg font-bold">{property.title}</h3>
                  <p className="text-sm">দাম: ${property.price}</p>
                  <p className="text-xs text-gray-500">অবস্থান: {property.location}</p>
                  <p className="text-xs text-gray-400">দেখানো হয়েছে: {property.createdBy}</p>
                  {user?.email === property.createdBy && (
                    <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteProperty(property.id)}
                        disabled={loading}
                      >
                        মুছে ফেলুন
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* যোগাযোগ ফরম */}
      <motion.div
        className="my-10 max-w-md mx-auto bg-white p-6 rounded shadow"
        variants={fadeInUp}
      >
        <h2 className="text-xl font-semibold mb-4">যোগাযোগ করুন</h2>

        <input
          type="text"
          placeholder="আপনার নাম"
          className="border p-2 w-full mb-2"
          value={contactForm.name}
          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
        />

        <textarea
          placeholder="আপনার বার্তা"
          className="border p-2 w-full mb-2"
          value={contactForm.message}
          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
        ></textarea>

        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={handleContactSubmit} disabled={loading}>
            বার্তা পাঠান
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase config (env variable থেকে নেওয়া ভালো)
// .env.local ফাইলে রাখো, যেমন: REACT_APP_FIREBASE_API_KEY=...
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export default function RealEstateWebsite() {
  const [user, setUser] = useState(null);

  // প্রপার্টিগুলোর তালিকা
  const [properties, setProperties] = useState([]);

  // নতুন প্রপার্টির ডাটা (টাইটেল, প্রাইস, লোকেশন, ছবি)
  const [newProperty, setNewProperty] = useState({
    title: "",
    price: "",
    location: "",
    image: null,
  });

  // ছবি প্রিভিউ দেখানোর জন্য ইউআরএল
  const [imagePreview, setImagePreview] = useState(null);

  // ইউজারের লগইন / সাইনআপ ফর্ম ডাটা
  const [authForm, setAuthForm] = useState({ email: "", password: "" });

  // লগইন না সাইনআপ মোড
  const [mode, setMode] = useState("login");

  // যোগাযোগ ফর্ম ডাটা
  const [contactForm, setContactForm] = useState({ name: "", message: "" });

  // লোডিং স্টেট
  const [loading, setLoading] = useState(false);

  // ত্রুটি বার্তা দেখানোর জন্য
  const [error, setError] = useState("");

  // ইউজারের অটোমেটিক লগইন চেক এবং প্রপার্টি লিস্ট রিয়েল-টাইম
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubProperties = onSnapshot(collection(db, "properties"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProperties(data);
    });

    return () => {
      unsubAuth();
      unsubProperties();
    };
  }, []);

  // ইউজার সাইনআপ / লগইন হ্যান্ডলার
  const handleAuth = async () => {
    setError("");
    if (!authForm.email || !authForm.password) {
      setError("অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // লগআউট ফাংশন
  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      alert("লগআউট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // নতুন প্রপার্টি যোগ করার ফাংশন
  const handleAddProperty = async () => {
    setError("");
    const { title, price, location, image } = newProperty;

    // সহজ ভ্যালিডেশন
    if (!title || !price || !location || !image) {
      setError("সব ফিল্ড অবশ্যই পূরণ করুন।");
      return;
    }

    setLoading(true);
    try {
      // ছবির জন্য রেফারেন্স তৈরি ও আপলোড
      const imageRef = ref(storage, `properties/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);

      // আপলোডকৃত ছবির URL নিন
      const imageUrl = await getDownloadURL(imageRef);

      // ফায়ারস্টোরে নতুন ডকুমেন্ট যোগ করুন
      await addDoc(collection(db, "properties"), {
        title,
        price,
        location,
        image: imageUrl,
        createdBy: user.email,
        createdAt: serverTimestamp(),
      });

      // ফরম রিসেট
      setNewProperty({ title: "", price: "", location: "", image: null });
      setImagePreview(null);
    } catch (err) {
      setError("প্রপার্টি যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // প্রপার্টি মুছে ফেলার ফাংশন
  const handleDeleteProperty = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে প্রপার্টি মুছে ফেলতে চান?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "properties", id));
    } catch (err) {
      alert("প্রপার্টি মুছে ফেলতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // যোগাযোগ ফর্ম সাবমিট
  const handleContactSubmit = async () => {
    setError("");
    if (!contactForm.name || !contactForm.message) {
      setError("আপনার নাম ও বার্তা অবশ্যই দিন।");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "contacts"), {
        ...contactForm,
        submittedAt: serverTimestamp(),
      });
      alert("বার্তা সফলভাবে পাঠানো হয়েছে!");
      setContactForm({ name: "", message: "" });
    } catch (err) {
      alert("বার্তা পাঠাতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // ছবি ফাইল সিলেক্ট করলে প্রিভিউ দেখানোর জন্য
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProperty({ ...newProperty, image: file });

      // প্রিভিউ জন্য URL তৈরি
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setNewProperty({ ...newProperty, image: null });
      setImagePreview(null);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="p-6"
    >
      <motion.h1 className="text-3xl font-bold text-green-600" variants={fadeInUp}>
        মকান
      </motion.h1>

      {loading && (
        <motion.p
          className="text-sm text-center my-2 text-blue-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          প্রক্রিয়াজাত হচ্ছে...
        </motion.p>
      )}

      {error && (
        <motion.p
          className="text-sm text-center my-2 text-red-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}

      {!user ? (
        <motion.div
          className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow"
          variants={fadeInUp}
        >
          <h2 className="text-xl font-bold mb-4 text-center">
            {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
          </h2>

          <input
            type="email"
            placeholder="ইমেইল"
            className="border p-2 w-full mb-2"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="পাসওয়ার্ড"
            className="border p-2 w-full mb-4"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          />

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAuth} disabled={loading} className="w-full mb-2">
              {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
            </Button>
          </motion.div>

          <p className="text-sm text-center">
            {mode === "signup" ? "আগেই একাউন্ট আছে?" : "একাউন্ট নেই?"}{" "}
            <span
              className="text-green-600 cursor-pointer"
              onClick={() => {
                setError("");
                setMode(mode === "signup" ? "login" : "signup");
              }}
            >
              {mode === "signup" ? "লগ ইন করুন" : "সাইন আপ করুন"}
            </span>
          </p>
        </motion.div>
      ) : (
        <motion.div className="my-4 space-x-2 text-right" variants={fadeInUp}>
          <span className="text-green-600">স্বাগতম, {user.email}</span>
          <Button onClick={handleLogout} disabled={loading}>
            লগ আউট
          </Button>
        </motion.div>
      )}

      {user && (
        <motion.div className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow" variants={fadeInUp}>
          <h2 className="text-xl font-semibold mb-2">নতুন প্রপার্টি যোগ করুন</h2>

          <input
            type="text"
            placeholder="শিরোনাম"
            value={newProperty.title}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, title: e.target.value })}
          />

          <input
            type="text"
            placeholder="দাম"
            value={newProperty.price}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, price: e.target.value })}
          />

          <input
            type="text"
            placeholder="অবস্থান"
            value={newProperty.location}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, location: e.target.value })}
          />

          <input type="file" className="block my-2" onChange={handleImageChange} />

          {imagePreview && (
            <img
              src={imagePreview}
              alt="ছবির প্রিভিউ"
              className="w-48 h-32 object-cover rounded my-2"
            />
          )}

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAddProperty} disabled={loading}>
              প্রপার্টি জমা দিন
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* প্রপার্টি গুলো দেখানোর অংশ */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <AnimatePresence>
          {properties.map((property) => (
            <motion.div
              key={property.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="hover:shadow-xl transition">
                <CardContent>
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={property.image}
                    alt={property.title}
                    className="rounded mb-2"
                  />
                  <h3 className="text-lg font-bold">{property.title}</h3>
                  <p className="text-sm">দাম: ${property.price}</p>
                  <p className="text-xs text-gray-500">অবস্থান: {property.location}</p>
                  <p className="text-xs text-gray-400">দেখানো হয়েছে: {property.createdBy}</p>
                  {user?.email === property.createdBy && (
                    <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteProperty(property.id)}
                        disabled={loading}
                      >
                        মুছে ফেলুন
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* যোগাযোগ ফরম */}
      <motion.div
        className="my-10 max-w-md mx-auto bg-white p-6 rounded shadow"
        variants={fadeInUp}
      >
        <h2 className="text-xl font-semibold mb-4">যোগাযোগ করুন</h2>

        <input
          type="text"
          placeholder="আপনার নাম"
          className="border p-2 w-full mb-2"
          value={contactForm.name}
          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
        />

        <textarea
          placeholder="আপনার বার্তা"
          className="border p-2 w-full mb-2"
          value={contactForm.message}
          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
        ></textarea>

        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={handleContactSubmit} disabled={loading}>
            বার্তা পাঠান
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase config (env variable থেকে নেওয়া ভালো)
// .env.local ফাইলে রাখো, যেমন: REACT_APP_FIREBASE_API_KEY=...
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export default function RealEstateWebsite() {
  const [user, setUser] = useState(null);

  // প্রপার্টিগুলোর তালিকা
  const [properties, setProperties] = useState([]);

  // নতুন প্রপার্টির ডাটা (টাইটেল, প্রাইস, লোকেশন, ছবি)
  const [newProperty, setNewProperty] = useState({
    title: "",
    price: "",
    location: "",
    image: null,
  });

  // ছবি প্রিভিউ দেখানোর জন্য ইউআরএল
  const [imagePreview, setImagePreview] = useState(null);

  // ইউজারের লগইন / সাইনআপ ফর্ম ডাটা
  const [authForm, setAuthForm] = useState({ email: "", password: "" });

  // লগইন না সাইনআপ মোড
  const [mode, setMode] = useState("login");

  // যোগাযোগ ফর্ম ডাটা
  const [contactForm, setContactForm] = useState({ name: "", message: "" });

  // লোডিং স্টেট
  const [loading, setLoading] = useState(false);

  // ত্রুটি বার্তা দেখানোর জন্য
  const [error, setError] = useState("");

  // ইউজারের অটোমেটিক লগইন চেক এবং প্রপার্টি লিস্ট রিয়েল-টাইম
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubProperties = onSnapshot(collection(db, "properties"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProperties(data);
    });

    return () => {
      unsubAuth();
      unsubProperties();
    };
  }, []);

  // ইউজার সাইনআপ / লগইন হ্যান্ডলার
  const handleAuth = async () => {
    setError("");
    if (!authForm.email || !authForm.password) {
      setError("অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // লগআউট ফাংশন
  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      alert("লগআউট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // নতুন প্রপার্টি যোগ করার ফাংশন
  const handleAddProperty = async () => {
    setError("");
    const { title, price, location, image } = newProperty;

    // সহজ ভ্যালিডেশন
    if (!title || !price || !location || !image) {
      setError("সব ফিল্ড অবশ্যই পূরণ করুন।");
      return;
    }

    setLoading(true);
    try {
      // ছবির জন্য রেফারেন্স তৈরি ও আপলোড
      const imageRef = ref(storage, `properties/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);

      // আপলোডকৃত ছবির URL নিন
      const imageUrl = await getDownloadURL(imageRef);

      // ফায়ারস্টোরে নতুন ডকুমেন্ট যোগ করুন
      await addDoc(collection(db, "properties"), {
        title,
        price,
        location,
        image: imageUrl,
        createdBy: user.email,
        createdAt: serverTimestamp(),
      });

      // ফরম রিসেট
      setNewProperty({ title: "", price: "", location: "", image: null });
      setImagePreview(null);
    } catch (err) {
      setError("প্রপার্টি যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // প্রপার্টি মুছে ফেলার ফাংশন
  const handleDeleteProperty = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে প্রপার্টি মুছে ফেলতে চান?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "properties", id));
    } catch (err) {
      alert("প্রপার্টি মুছে ফেলতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // যোগাযোগ ফর্ম সাবমিট
  const handleContactSubmit = async () => {
    setError("");
    if (!contactForm.name || !contactForm.message) {
      setError("আপনার নাম ও বার্তা অবশ্যই দিন।");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "contacts"), {
        ...contactForm,
        submittedAt: serverTimestamp(),
      });
      alert("বার্তা সফলভাবে পাঠানো হয়েছে!");
      setContactForm({ name: "", message: "" });
    } catch (err) {
      alert("বার্তা পাঠাতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // ছবি ফাইল সিলেক্ট করলে প্রিভিউ দেখানোর জন্য
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProperty({ ...newProperty, image: file });

      // প্রিভিউ জন্য URL তৈরি
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setNewProperty({ ...newProperty, image: null });
      setImagePreview(null);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="p-6"
    >
      <motion.h1 className="text-3xl font-bold text-green-600" variants={fadeInUp}>
        মকান
      </motion.h1>

      {loading && (
        <motion.p
          className="text-sm text-center my-2 text-blue-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          প্রক্রিয়াজাত হচ্ছে...
        </motion.p>
      )}

      {error && (
        <motion.p
          className="text-sm text-center my-2 text-red-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}

      {!user ? (
        <motion.div
          className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow"
          variants={fadeInUp}
        >
          <h2 className="text-xl font-bold mb-4 text-center">
            {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
          </h2>

          <input
            type="email"
            placeholder="ইমেইল"
            className="border p-2 w-full mb-2"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="পাসওয়ার্ড"
            className="border p-2 w-full mb-4"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          />

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAuth} disabled={loading} className="w-full mb-2">
              {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
            </Button>
          </motion.div>

          <p className="text-sm text-center">
            {mode === "signup" ? "আগেই একাউন্ট আছে?" : "একাউন্ট নেই?"}{" "}
            <span
              className="text-green-600 cursor-pointer"
              onClick={() => {
                setError("");
                setMode(mode === "signup" ? "login" : "signup");
              }}
            >
              {mode === "signup" ? "লগ ইন করুন" : "সাইন আপ করুন"}
            </span>
          </p>
        </motion.div>
      ) : (
        <motion.div className="my-4 space-x-2 text-right" variants={fadeInUp}>
          <span className="text-green-600">স্বাগতম, {user.email}</span>
          <Button onClick={handleLogout} disabled={loading}>
            লগ আউট
          </Button>
        </motion.div>
      )}

      {user && (
        <motion.div className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow" variants={fadeInUp}>
          <h2 className="text-xl font-semibold mb-2">নতুন প্রপার্টি যোগ করুন</h2>

          <input
            type="text"
            placeholder="শিরোনাম"
            value={newProperty.title}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, title: e.target.value })}
          />

          <input
            type="text"
            placeholder="দাম"
            value={newProperty.price}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, price: e.target.value })}
          />

          <input
            type="text"
            placeholder="অবস্থান"
            value={newProperty.location}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, location: e.target.value })}
          />

          <input type="file" className="block my-2" onChange={handleImageChange} />

          {imagePreview && (
            <img
              src={imagePreview}
              alt="ছবির প্রিভিউ"
              className="w-48 h-32 object-cover rounded my-2"
            />
          )}

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAddProperty} disabled={loading}>
              প্রপার্টি জমা দিন
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* প্রপার্টি গুলো দেখানোর অংশ */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <AnimatePresence>
          {properties.map((property) => (
            <motion.div
              key={property.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="hover:shadow-xl transition">
                <CardContent>
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={property.image}
                    alt={property.title}
                    className="rounded mb-2"
                  />
                  <h3 className="text-lg font-bold">{property.title}</h3>
                  <p className="text-sm">দাম: ${property.price}</p>
                  <p className="text-xs text-gray-500">অবস্থান: {property.location}</p>
                  <p className="text-xs text-gray-400">দেখানো হয়েছে: {property.createdBy}</p>
                  {user?.email === property.createdBy && (
                    <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteProperty(property.id)}
                        disabled={loading}
                      >
                        মুছে ফেলুন
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* যোগাযোগ ফরম */}
      <motion.div
        className="my-10 max-w-md mx-auto bg-white p-6 rounded shadow"
        variants={fadeInUp}
      >
        <h2 className="text-xl font-semibold mb-4">যোগাযোগ করুন</h2>

        <input
          type="text"
          placeholder="আপনার নাম"
          className="border p-2 w-full mb-2"
          value={contactForm.name}
          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
        />

        <textarea
          placeholder="আপনার বার্তা"
          className="border p-2 w-full mb-2"
          value={contactForm.message}
          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
        ></textarea>

        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={handleContactSubmit} disabled={loading}>
            বার্তা পাঠান
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Firebase config (env variable থেকে নেওয়া ভালো)
// .env.local ফাইলে রাখো, যেমন: REACT_APP_FIREBASE_API_KEY=...
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export default function RealEstateWebsite() {
  const [user, setUser] = useState(null);

  // প্রপার্টিগুলোর তালিকা
  const [properties, setProperties] = useState([]);

  // নতুন প্রপার্টির ডাটা (টাইটেল, প্রাইস, লোকেশন, ছবি)
  const [newProperty, setNewProperty] = useState({
    title: "",
    price: "",
    location: "",
    image: null,
  });

  // ছবি প্রিভিউ দেখানোর জন্য ইউআরএল
  const [imagePreview, setImagePreview] = useState(null);

  // ইউজারের লগইন / সাইনআপ ফর্ম ডাটা
  const [authForm, setAuthForm] = useState({ email: "", password: "" });

  // লগইন না সাইনআপ মোড
  const [mode, setMode] = useState("login");

  // যোগাযোগ ফর্ম ডাটা
  const [contactForm, setContactForm] = useState({ name: "", message: "" });

  // লোডিং স্টেট
  const [loading, setLoading] = useState(false);

  // ত্রুটি বার্তা দেখানোর জন্য
  const [error, setError] = useState("");

  // ইউজারের অটোমেটিক লগইন চেক এবং প্রপার্টি লিস্ট রিয়েল-টাইম
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    const unsubProperties = onSnapshot(collection(db, "properties"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProperties(data);
    });

    return () => {
      unsubAuth();
      unsubProperties();
    };
  }, []);

  // ইউজার সাইনআপ / লগইন হ্যান্ডলার
  const handleAuth = async () => {
    setError("");
    if (!authForm.email || !authForm.password) {
      setError("অনুগ্রহ করে ইমেইল এবং পাসওয়ার্ড দিন।");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // লগআউট ফাংশন
  const handleLogout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      alert("লগআউট করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // নতুন প্রপার্টি যোগ করার ফাংশন
  const handleAddProperty = async () => {
    setError("");
    const { title, price, location, image } = newProperty;

    // সহজ ভ্যালিডেশন
    if (!title || !price || !location || !image) {
      setError("সব ফিল্ড অবশ্যই পূরণ করুন।");
      return;
    }

    setLoading(true);
    try {
      // ছবির জন্য রেফারেন্স তৈরি ও আপলোড
      const imageRef = ref(storage, `properties/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);

      // আপলোডকৃত ছবির URL নিন
      const imageUrl = await getDownloadURL(imageRef);

      // ফায়ারস্টোরে নতুন ডকুমেন্ট যোগ করুন
      await addDoc(collection(db, "properties"), {
        title,
        price,
        location,
        image: imageUrl,
        createdBy: user.email,
        createdAt: serverTimestamp(),
      });

      // ফরম রিসেট
      setNewProperty({ title: "", price: "", location: "", image: null });
      setImagePreview(null);
    } catch (err) {
      setError("প্রপার্টি যোগ করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।");
    }
    setLoading(false);
  };

  // প্রপার্টি মুছে ফেলার ফাংশন
  const handleDeleteProperty = async (id) => {
    if (!window.confirm("আপনি কি নিশ্চিত যে প্রপার্টি মুছে ফেলতে চান?")) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, "properties", id));
    } catch (err) {
      alert("প্রপার্টি মুছে ফেলতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // যোগাযোগ ফর্ম সাবমিট
  const handleContactSubmit = async () => {
    setError("");
    if (!contactForm.name || !contactForm.message) {
      setError("আপনার নাম ও বার্তা অবশ্যই দিন।");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "contacts"), {
        ...contactForm,
        submittedAt: serverTimestamp(),
      });
      alert("বার্তা সফলভাবে পাঠানো হয়েছে!");
      setContactForm({ name: "", message: "" });
    } catch (err) {
      alert("বার্তা পাঠাতে সমস্যা হয়েছে।");
    }
    setLoading(false);
  };

  // ছবি ফাইল সিলেক্ট করলে প্রিভিউ দেখানোর জন্য
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProperty({ ...newProperty, image: file });

      // প্রিভিউ জন্য URL তৈরি
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setNewProperty({ ...newProperty, image: null });
      setImagePreview(null);
    }
  };

  const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.1 } } }}
      className="p-6"
    >
      <motion.h1 className="text-3xl font-bold text-green-600" variants={fadeInUp}>
        মকান
      </motion.h1>

      {loading && (
        <motion.p
          className="text-sm text-center my-2 text-blue-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          প্রক্রিয়াজাত হচ্ছে...
        </motion.p>
      )}

      {error && (
        <motion.p
          className="text-sm text-center my-2 text-red-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {error}
        </motion.p>
      )}

      {!user ? (
        <motion.div
          className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow"
          variants={fadeInUp}
        >
          <h2 className="text-xl font-bold mb-4 text-center">
            {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
          </h2>

          <input
            type="email"
            placeholder="ইমেইল"
            className="border p-2 w-full mb-2"
            value={authForm.email}
            onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
          />

          <input
            type="password"
            placeholder="পাসওয়ার্ড"
            className="border p-2 w-full mb-4"
            value={authForm.password}
            onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
          />

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAuth} disabled={loading} className="w-full mb-2">
              {mode === "signup" ? "সাইন আপ" : "লগ ইন"}
            </Button>
          </motion.div>

          <p className="text-sm text-center">
            {mode === "signup" ? "আগেই একাউন্ট আছে?" : "একাউন্ট নেই?"}{" "}
            <span
              className="text-green-600 cursor-pointer"
              onClick={() => {
                setError("");
                setMode(mode === "signup" ? "login" : "signup");
              }}
            >
              {mode === "signup" ? "লগ ইন করুন" : "সাইন আপ করুন"}
            </span>
          </p>
        </motion.div>
      ) : (
        <motion.div className="my-4 space-x-2 text-right" variants={fadeInUp}>
          <span className="text-green-600">স্বাগতম, {user.email}</span>
          <Button onClick={handleLogout} disabled={loading}>
            লগ আউট
          </Button>
        </motion.div>
      )}

      {user && (
        <motion.div className="my-6 max-w-md mx-auto bg-white p-6 rounded shadow" variants={fadeInUp}>
          <h2 className="text-xl font-semibold mb-2">নতুন প্রপার্টি যোগ করুন</h2>

          <input
            type="text"
            placeholder="শিরোনাম"
            value={newProperty.title}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, title: e.target.value })}
          />

          <input
            type="text"
            placeholder="দাম"
            value={newProperty.price}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, price: e.target.value })}
          />

          <input
            type="text"
            placeholder="অবস্থান"
            value={newProperty.location}
            className="border p-2 block my-2 w-full"
            onChange={(e) => setNewProperty({ ...newProperty, location: e.target.value })}
          />

          <input type="file" className="block my-2" onChange={handleImageChange} />

          {imagePreview && (
            <img
              src={imagePreview}
              alt="ছবির প্রিভিউ"
              className="w-48 h-32 object-cover rounded my-2"
            />
          )}

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button onClick={handleAddProperty} disabled={loading}>
              প্রপার্টি জমা দিন
            </Button>
          </motion.div>
        </motion.div>
      )}

      {/* প্রপার্টি গুলো দেখানোর অংশ */}
      <div className="grid md:grid-cols-3 gap-4 mt-6">
        <AnimatePresence>
          {properties.map((property) => (
            <motion.div
              key={property.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="hover:shadow-xl transition">
                <CardContent>
                  <motion.img
                    whileHover={{ scale: 1.05 }}
                    src={property.image}
                    alt={property.title}
                    className="rounded mb-2"
                  />
                  <h3 className="text-lg font-bold">{property.title}</h3>
                  <p className="text-sm">দাম: ${property.price}</p>
                  <p className="text-xs text-gray-500">অবস্থান: {property.location}</p>
                  <p className="text-xs text-gray-400">দেখানো হয়েছে: {property.createdBy}</p>
                  {user?.email === property.createdBy && (
                    <motion.div whileTap={{ scale: 0.95 }} className="mt-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteProperty(property.id)}
                        disabled={loading}
                      >
                        মুছে ফেলুন
                      </Button>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* যোগাযোগ ফরম */}
      <motion.div
        className="my-10 max-w-md mx-auto bg-white p-6 rounded shadow"
        variants={fadeInUp}
      >
        <h2 className="text-xl font-semibold mb-4">যোগাযোগ করুন</h2>

        <input
          type="text"
          placeholder="আপনার নাম"
          className="border p-2 w-full mb-2"
          value={contactForm.name}
          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
        />

        <textarea
          placeholder="আপনার বার্তা"
          className="border p-2 w-full mb-2"
          value={contactForm.message}
          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
        ></textarea>

        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={handleContactSubmit} disabled={loading}>
            বার্তা পাঠান
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
