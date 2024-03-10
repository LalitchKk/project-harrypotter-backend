import express from "express";

export const router = express.Router();
const currentDate: Date = new Date();
router.get('/', (req, res)=>{
    res.render('Get in index.ts'+currentDate);
});
