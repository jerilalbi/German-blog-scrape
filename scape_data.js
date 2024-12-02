const path = require('path');
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const csvWriter = require('csv-writer');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const csv = require('csv-parser');
const url = require('url');
const { timeout } = require('puppeteer');

const linuxUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36";

puppeteer.use(StealthPlugin());
(async () => {
    try {
        // const extensionPath = path.join(process.cwd(), 'my-extension');
        // let pageLimit = 370;
        let pageLimit = 10000;
        let websiteData = [];
        // const webisteCategory = "technology-blog";
        const webisteCategory = "blog";
        let testNo = 1;

        const browser = await puppeteer.launch({
            // headless: "new",
            headless: false,
        });

        const page = await browser.newPage();
        await page.setUserAgent(linuxUserAgent);
        outerLoop: for (let pageNo = 6063; pageNo <= pageLimit; pageNo++) {
            await page.goto(`https://www.webwiki.de/${webisteCategory}?page=${pageNo}`, { waitUntil: 'networkidle2' });
            // await page.goto(`https://www.webwiki.de/neueste-bewertungen/a.html?page=1`, { waitUntil: 'networkidle2' });

            await page.waitForSelector("#websitelist")
            await page.waitForSelector(".suchinfo.pull-right.hidden-xs")
            const links = await page.$$eval(".domaintitle > a", el => {
                return el.map((val) => val.innerText)
            });

            // const allPages = await page.$eval(".suchinfo.pull-right.hidden-xs", el => el.innerText);
            // const totalPages = allPages.match(/\d+$/)[0];
            // pageLimit = totalPages;

            for (const link of links) {
                try {
                    if (link.toLowerCase().endsWith(".de")) {
                        console.log(testNo);
                        testNo++;

                        const websitePage = await browser.newPage();
                        await websitePage.setUserAgent(linuxUserAgent);

                        try {
                            // await websitePage.goto(`https://www.skoda-portal.de/`, { waitUntil: 'networkidle2' });
                            await websitePage.goto(`https://www.${link}`, { waitUntil: 'networkidle2' });
                        } catch (error) { }

                        await websitePage.waitForSelector("body", { timeout: "60000" })

                        const elementCount = await websitePage.evaluate(() => {
                            return document.body.querySelectorAll('*').length;
                        });

                        if (elementCount > 10) {

                            let inputDate;
                            let lastUpdatedDate = await websitePage.evaluate(() => {
                                const metaTag = document.querySelector('meta[property="article:modified_time"]');
                                return metaTag ? metaTag.getAttribute('content') : null;
                            });
                            // let lastUpdatedDate;

                            if (lastUpdatedDate) {
                                inputDate = new Date(lastUpdatedDate);
                            } else {
                                lastUpdatedDate = await checkXmlPage(link);
                                inputDate = new Date(lastUpdatedDate)
                            }

                            const oneYearAgo = new Date();
                            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                            if (lastUpdatedDate && inputDate < oneYearAgo) {
                                console.log(`${link}: ${lastUpdatedDate.split("T")[0]}`);

                                const hasAds = await websitePage.evaluate(() => {
                                    const bodyText = document.body.innerHTML.toLowerCase();
                                    const adKeywords = ['advertisement', 'promoted', 'adservice.google.com', 'adsbygoogle'];
                                    return adKeywords.some(keyword => bodyText.includes(keyword));
                                });

                                if (hasAds) {
                                    console.log('Website with ads = ' + link);
                                } else {
                                    const trafficPage = await browser.newPage();
                                    await trafficPage.setUserAgent(linuxUserAgent);
                                    await trafficPage.goto(`https://data.similarweb.com/api/v1/data?domain=${link}`, { waitUntil: 'networkidle2' });

                                    const jsonData = await trafficPage.evaluate(() => {
                                        return JSON.parse(document.body.innerText);
                                    });

                                    const avgTrafficData = parseInt((jsonData["EstimatedMonthlyVisits"]["2024-10-01"] + jsonData["EstimatedMonthlyVisits"]["2024-09-01"] + jsonData["EstimatedMonthlyVisits"]["2024-08-01"]) / 3);


                                    if (avgTrafficData >= 1000 && avgTrafficData <= 10000) {
                                        websiteData.push({
                                            name: link,
                                            monthly_viewers: avgTrafficData,
                                            last_updated: lastUpdatedDate.split("T")[0],
                                            website: `https://www.${link}`
                                        })
                                    }
                                    await trafficPage.close();
                                }
                                console.log(`current data length = ${websiteData.length}`)
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                            if (websiteData.length >= 50) {

                                break outerLoop;
                            }
                        }
                        await websitePage.close();
                    }
                } catch (error) {
                    console.log(error.message)
                    if (error.message === "net::ERR_INTERNET_DISCONNECTED") {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            }
            if (websiteData.length > 0) {
                makeExcelFile(websiteData);
            }
            console.log(`page no: ${pageNo}`);

        }
        await page.close();
        console.log(websiteData);
        // const allKeys = Array.from(new Set(websiteData.flatMap(Object.keys)));
        // const csvRows = [allKeys.join(',')];
        // websiteData.forEach(obj => {
        //     const row = allKeys.map(key => obj[key] || '');
        //     csvRows.push(row.join(','));
        // });
        // const finalData = csvRows.join('\n');
        // fs.writeFileSync('website_data.csv', finalData, 'utf8');

        makeExcelFile(websiteData);


        // fs.writeFileSync('demo.html', data);
        await browser.close();
    } catch (error) {
        console.log(error);
    }
});

function makeExcelFile(websiteData) {

    // const filePath = 'website_data.csv';

    // const fileExists = fs.existsSync(filePath);

    const writer = csvWriter.createObjectCsvWriter({
        path: 'website_data2.csv',
        header:
            [
                { id: 'name', title: 'Name' },
                { id: 'monthly_viewers', title: 'Viewers' },
                // { id: 'last_updated', title: 'Last Updated' },
                { id: 'url', title: 'URL' },
                // { id: 'email', title: 'Email' },
            ],
        append: true
    });

    // const formattedData = websiteData.map(item => ({
    //     ...item,
    //     url: `=HYPERLINK("${item.url}", "${item.url}")`
    // }));

    writer.writeRecords(websiteData)
        .then(() => {
            console.log('CSV file written successfully');
        })
        .catch(err => {
            console.error('Error writing CSV file:', err);
        });
}

async function checkXmlPage(link) {
    try {
        const url = `https://www.${link}/sitemap.xml`;
        const response = await axios.get(url);
        const xmlData = response.data;

        const parsedData = await parseStringPromise(xmlData);

        const urls = parsedData.urlset.url;
        if (urls[0].lastmod) {
            return urls[0].lastmod[0]
        }
    } catch (error) {

    }
}

(async () => {

    const csvPath = 'überarbeitet upwork typ.csv'
    try {
        const dataArray = await readCsvfile(csvPath);
        const websiteData = [];

        const browser = await puppeteer.launch({
            // headless: "new",
            headless: false,
        });

        const page = await browser.newPage();
        await page.setUserAgent(linuxUserAgent);

        for (let i = 0; i < dataArray.length; i++) {
            try {
                console.log(i + 1);

                // await page.goto(`https://www.carinaontour.de/impressum/`, { waitUntil: 'networkidle2' });
                await page.goto(`https://www.${dataArray[i].Name}/impressum`, { waitUntil: 'networkidle2' });

                const emails = await page.evaluate(() => {
                    const bodyText = document.body.innerText;
                    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/g;
                    const matches = bodyText.match(emailRegex);
                    return matches ? [...new Set(matches)] : [];
                });

                websiteData.push({
                    name: dataArray[i].Name,
                    monthly_viewers: dataArray[i].Viewers,
                    last_updated: dataArray[i]['Last Updated'],
                    url: `https://www.${dataArray[i].Name}`,
                    email: emails.length > 0 ? emails[0] : ""
                })

                if (i % 10 === 0) {
                    makeExcelFile(websiteData)
                }
            } catch (error) {

            }
        }
        makeExcelFile(websiteData);
        await browser.close();
    } catch (error) {
        console.log(error)
    }
})

function readCsvfile(path) {
    return new Promise((resolve, reject) => {
        const resultData = [];
        fs.createReadStream(path).pipe(csv())
            .on('data', (data) => resultData.push(data))
            .on('end', () => resolve(resultData))
            .on('error', (error) => reject(error))
    })
}

async function getBlogDatas() {
    try {
        const currentDataSet = new Set();

        const currentDataPath = "website_data_sample.csv";
        const currentData = await readCsvfile(currentDataPath);
        currentData.forEach(item => currentDataSet.add(item.Name));

        const links = [
            "https://www.bloggerei.de/rubrik_15_Computerblogs",
            "https://www.bloggerei.de/rubrik_8_Fotoblogs",
            "https://www.bloggerei.de/rubrik_17_Funnyblogs",
            "https://www.bloggerei.de/rubrik_10_Hobbyblogs",
            "https://www.bloggerei.de/rubrik_19_Jobblogs",
            "https://www.bloggerei.de/rubrik_4_Kulturblogs",
            "https://www.bloggerei.de/rubrik_12_Literaturblogs",
            "https://www.bloggerei.de/rubrik_13_Musikblogs",
            "https://www.bloggerei.de/rubrik_18_Privateblogs",
            "https://www.bloggerei.de/rubrik_14_Seoblogs",
            "https://www.bloggerei.de/rubrik_3_Sportblogs",
            "https://www.bloggerei.de/rubrik_16_Tierblogs",
            "https://www.bloggerei.de/rubrik_1_Wirtschaftsblogs",
            "https://www.bloggerei.de/rubrik_21_Corporateblogs",
            "https://www.bloggerei.de/rubrik_11_Freizeitblogs",
            "https://www.bloggerei.de/rubrik_24_Gourmetblogs",
            "https://www.bloggerei.de/rubrik_6_Internetblogs",
            "https://www.bloggerei.de/rubrik_26_Jurablogs",
            "https://www.bloggerei.de/rubrik_5_Kunstblogs",
            "https://www.bloggerei.de/rubrik_20_Medizinblogs",
            "https://www.bloggerei.de/rubrik_2_Politikblogs",
            "https://www.bloggerei.de/rubrik_7_Reiseblogs",
            "https://www.bloggerei.de/rubrik_25_Spieleblogs",
            "https://www.bloggerei.de/rubrik_23_Stadtblogs",
            "https://www.bloggerei.de/rubrik_27_Umweltblogs",
            "https://www.bloggerei.de/rubrik_22_Wissenschaftsblogs",
        ];

        let pageLimit = 30;
        let testIndex = 1;
        const websiteData = [];

        const browser = await puppeteer.launch({
            headless: false,
        });

        const page = await browser.newPage();
        await page.setUserAgent(linuxUserAgent);

        for (let link of links) {
            for (let i = 19; i <= pageLimit; i++) {
                try {
                    console.log(testIndex);
                    testIndex++;

                    await page.goto(`${link}_${i}`, { waitUntil: 'networkidle2' })

                    await page.waitForSelector(".maincontent", { timeout: "60000" });

                    pageLimit = await page.$$eval('.pagination-bottom > a ', (anchors) => parseInt(anchors[anchors.length - 1].innerText, 10));

                    // const blogs = await page.evaluate(() => {
                    //     try {
                    //         const blogData = [];
                    //         const blogElements = document.querySelectorAll('.bloginfos');

                    //         blogElements.forEach((blog) => {
                    //             const rawLink = blog.querySelector('.extblog').href;
                    //             const rawDate = blog.querySelector('.posttime').innerText;
                    //             const parsedUrl = new URL(rawLink);
                    //             const link = parsedUrl.protocol + '//' + parsedUrl.hostname;
                    //             const dateData = rawDate.match(/\d+/);
                    //             const date = parseInt(dateData[0], 10);

                    //             blogData.push({ link, date });
                    //         })
                    //         return blogData;
                    //     } catch (error) {
                    //         console.log(error);
                    //     }
                    // });
                    const blogs = await page.$$eval(".bloginfos", el => {
                        const blogData = [];
                        el.forEach((blog) => {
                            const rawLink = blog.querySelector('.extblog').href;
                            const rawDate = blog.querySelector('.posttime').innerText;
                            const parsedUrl = new URL(rawLink);
                            const link = parsedUrl.protocol + '//' + parsedUrl.hostname;
                            const dateData = rawDate.match(/\d+/);
                            const date = parseInt(dateData[0], 10);

                            blogData.push({ link, date });
                        })
                        return blogData;
                    })
                    console.log(blogs);

                    if (blogs[blogs.length - 1].date >= 365) {
                        for (const blog of blogs) {
                            if (blog.link.toLowerCase().endsWith(".de") && blog.date > 365) {
                                try {
                                    console.log(blog.link)
                                    const blogPage = await browser.newPage();
                                    await blogPage.setUserAgent(linuxUserAgent);

                                    await blogPage.goto(blog.link, { waitUntil: 'networkidle2' })

                                    await blogPage.waitForSelector("body", { timeout: "60000" })

                                    const elementCount = await blogPage.evaluate(() => {
                                        return document.body.querySelectorAll('*').length;
                                    });

                                    if (elementCount > 10) {
                                        if (!currentDataSet.has(blog.link)) {
                                            const trafficPage = await browser.newPage();
                                            await trafficPage.setUserAgent(linuxUserAgent);
                                            await trafficPage.goto(`https://data.similarweb.com/api/v1/data?domain=${blog.link}`, { waitUntil: 'networkidle2' });

                                            const jsonData = await trafficPage.evaluate(() => {
                                                return JSON.parse(document.body.innerText);
                                            });

                                            const avgTrafficData = parseInt((jsonData["EstimatedMonthlyVisits"]["2024-10-01"] + jsonData["EstimatedMonthlyVisits"]["2024-09-01"] + jsonData["EstimatedMonthlyVisits"]["2024-08-01"]) / 3);

                                            if (avgTrafficData >= 1000 && avgTrafficData <= 10000) {
                                                websiteData.push({
                                                    name: new URL(blog.link).hostname.replace(/^www\./, ''),
                                                    monthly_viewers: avgTrafficData,
                                                    url: blog.link,
                                                })
                                            }
                                            await new Promise(r => setTimeout(r, 3000))
                                            await trafficPage.close();
                                        }
                                    }
                                    await blogPage.close();
                                } catch (error) { }
                            }
                        }
                    }
                    if (websiteData.length > 0) {
                        makeExcelFile(websiteData);
                    }
                    await new Promise(r => setTimeout(r, 2000))
                } catch (error) {

                }
            }

        }
        makeExcelFile(websiteData);
        // await browser.close();
    } catch (error) {
        console.log(error)
    }
}

getBlogDatas();