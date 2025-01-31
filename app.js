import { readCSVFile } from './csvOp.js';
import { redandancyCheck } from './fileOP.js';
import { emailFinder, googleScraper } from './googleScraper.js';

(async () => {
    const websiteData = await readCSVFile("75_website_data.csv");
    // await emailFinder(websiteData);
    // await googleScraper();
    await redandancyCheck("75_website_data.csv");
})()