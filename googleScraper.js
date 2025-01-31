import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { appendCSV, readCSVFile } from "./csvOp.js";

chromium.use(StealthPlugin());


export const googleScraper = async () => {
    const websiteData = await readCSVFile("75_website_data.csv");
    const blogCategories = [
        "Computerblogs",
        "Fotoblogs",
        "Funnyblogs",
        "Hobbyblogs",
        // "Jobblogs",
        "Kulturblogs",
        "Literaturblogs",
        // "Musikblogs",
        // "Privateblogs",
        // "Seoblogs",
        "Sportblogs",
        "Tierblogs",
        // "Wirtschaftsblogs",
        // "Corporateblogs",
        "Freizeitblogs",
        // "Gourmetblogs",
        "Internetblogs",
        // "Jurablogs",
        "Kunstblogs",
        "Medizinblogs",
        // "Politikblogs",
        "Reiseblogs",
        "Spieleblogs",
        "Stadtblogs",
        // "Umweltblogs",
        "Wissenschaftsblogs",
        "Travelblogs",
        "Fashionblogs",
        "Beautyblogs",
        "Healthblogs",
        "Foodblogs",
        "Techblogs",
        "Gamingblogs",
        "Lifestyleblogs",
        "Fitnessblogs",
        "Parentingblogs",
        "DIYblogs",
        "Educationblogs",
        "Financeblogs",
        "Marketingblogs",
        "Photographyblogs",
        "Artblogs",
        "Designblogs",
        "Startupblogs",
        "blog",
    ]

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    });

    const page = await context.newPage()
    try {
        for (const blog of blogCategories) {
            await page.goto(`https://www.google.com/search?q=site:.de before:2023 inurl:blog ${blog}&num=100`)
            await page.waitForSelector("#search", { timeout: 180000 })
            const results = await page.$$(".yuRUbf");

            for (const result of results) {
                try {
                    const element = await result.$('a[jsname="UWckNb"]');
                    const baseUrl = element ? await element.getAttribute('href') : "";
                    // const date = await result.$eval("span.LEwnzc.Sqrs4e > span", (el) => el.innerText) ?? "";
                    if (baseUrl !== "") {
                        const parsedUrl = new URL(baseUrl); //yuRUbf
                        const link = parsedUrl.protocol + '//' + parsedUrl.hostname;

                        const urlResult = await analyzeUrl(link, context);
                        if (urlResult !== null) {
                            console.log(urlResult);
                            websiteData.push(urlResult);
                            await appendCSV(urlResult, "75_website_data.csv");
                        }
                    }
                    console.log(`Current Data Length: ${websiteData.length}`)
                } catch (error) {
                    console.log(error.message);
                }
            }
            // await page.waitForTimeout(2000000);
            console.log(`Finished: ${blog}`);
            // await page.waitForTimeout(200000)
        }
    } catch (error) {
        console.log(error.message);
    } finally {
        if (page) {
            await page.close()
        }
        await browser.close()
    }
}

const existingData = await readCSVFile("75_website_data.csv");
const existingDataSet = new Set(existingData.map(row => row.link.trim()));

export const analyzeUrl = async (url, browser) => {

    const page = await browser.newPage();
    try {
        await page.goto(url, { timeout: 60000 });
        await page.waitForTimeout(2000);
        const pageUrl = page.url();
        const cleanedUrl = pageUrl.replace(/\/$/, '');

        if (!existingDataSet.has(cleanedUrl)) {
            existingDataSet.add(cleanedUrl);
            if (cleanedUrl.endsWith(".de")) {
                const blogText = await page.evaluate(() => document.body.innerText);
                const count2024 = (blogText.match(/2024/g) || []).length;
                const count2025 = (blogText.match(/2025/g) || []).length;

                if (count2024 > 1 || count2025 > 1) {
                    return null;
                } else {
                    const links = await page.$$eval("iframe", anchor => anchor.map(atag => atag.src))

                    const googleAds = links.some(href => href.includes('https://googleads.g.doubleclick.net'));

                    if (googleAds) {
                        console.log("Google Ads detected: ", pageUrl);
                        return null;
                    } else {
                        const oneYearAgo = new Date();
                        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                        const lastModDate = await getLastModDate(page, pageUrl);

                        if (lastModDate === "Check Date") {
                            const avgTraffic = await getAvgTraffic(cleanedUrl);
                            const { hostname } = new URL(cleanedUrl);
                            const name = hostname.replace(/^www\./, '');

                            if (avgTraffic > 1000 && avgTraffic < 10000) {
                                return {
                                    link: cleanedUrl,
                                    traffic: avgTraffic,
                                    lastModDate: lastModDate,
                                    name: name
                                }
                            } else {
                                return null;
                            }
                        }

                        if (lastModDate < oneYearAgo) {

                            const avgTraffic = await getAvgTraffic(cleanedUrl);

                            if (avgTraffic > 1000 && avgTraffic < 10000) {
                                return {
                                    link: cleanedUrl,
                                    traffic: avgTraffic,
                                    lastModDate: lastModDate.toISOString().split('T')[0],
                                }
                            } else {
                                return null;
                            }

                        } else {
                            return null;
                        }
                    }
                }
            } else {
                return null;
            }
        }
    } catch (error) {
        console.log(error.message);
        return null;
    } finally {
        if (page) {
            await page.close()
        }
    }
}

export const getLastModDate = async (page, link) => {
    try {
        let inputDate;
        let lastUpdatedDate = await page.evaluate(() => {
            const metaTag = document.querySelector('meta[property="article:modified_time"]');
            return metaTag ? metaTag.getAttribute('content') : null;
        });

        if (lastUpdatedDate) {
            inputDate = new Date(lastUpdatedDate);
        } else {
            lastUpdatedDate = await checkXmlPage(link);
            inputDate = lastUpdatedDate === null ? "Check Date" : new Date(lastUpdatedDate)
        }

        return inputDate;
    } catch (error) {
        console.log(error.message);
    }
}

async function checkXmlPage(link) {
    try {
        const response = await axios.get(`${link}sitemap.xml`);
        const xmlContent = response.data;

        const parsedXml = await parseStringPromise(xmlContent);

        const lastmodDates = parsedXml.urlset.url.map(entry => new Date(entry.lastmod[0]));
        const latestLastmod = lastmodDates.reduce((latest, current) => (current > latest ? current : latest), new Date(0));
        const lastModString = latestLastmod.toISOString().split('T')[0];

        return lastModString;
    } catch (error) {
        console.log(error.message);
        return null;
    }
}

async function getAvgTraffic(cleanedUrl) {
    try {
        const trafficRes = await axios.get(`https://data.similarweb.com/api/v1/data?domain=${cleanedUrl}`, {
            headers: {
                "User-Agent": "PostmanRuntime/7.43.0",
            }
        });
        const trafficData = trafficRes.data;
        const visits = trafficData.EstimatedMonthlyVisits;

        const values = Object.values(visits);
        const sum = values.reduce((total, num) => total + num, 0);
        const avgTraffic = Math.floor(sum / values.length);

        return avgTraffic;
    } catch (error) {
        console.log(error.message);
        return 0;
    }
}

export const emailFinder = async (websiteData) => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {
        for (const data of websiteData.slice(70, websiteData.length)) {
            await page.goto(`${data.link.trim()}/impressum`, { timeout: 60000 });
            const bodyText = await page.evaluate(() => document.body.innerText);

            const normalizedText = bodyText
                .replace(/\s*\(at\)\s*/gi, "@")
                .replace(/\s*at\s*/gi, "@")
                .replace(/\s*\(dot\)\s*/gi, ".")
                .replace(/\s*dot\s*/gi, ".")
                .replace(/\s*\(punkt\)\s*/gi, ".")
                .replace(/\s*punkt\s*/gi, ".")
                .replace(/\s*\[at\]\s*/gi, '@')
                .replace(/\s*\[punkt\]\s*/gi, '.')
                .replace(/\s*\[dot\]\s*/gi, '.');

            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
            const matches = normalizedText.match(emailRegex);
            const finalData = { name: data.name, avgTraffic: data.traffic, link: data.link.trim(), email: matches ? matches[0] : "" };
            await appendCSV(finalData, "final_75_Data.csv");

        }
    } catch (error) {
        console.log(error.message);
    } finally {
        if (page) {
            await page.close();
        }
        await browser.close();
    }
}