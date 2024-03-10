import express from "express";

export const router = express.Router();
const currentDate: Date = new Date();
router.get('/', (req, res)=>{
    res.send('Get in index.ts'+currentDate);
});
