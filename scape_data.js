const { resolve } = require('path');
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const csvWriter = require('csv-writer');

const linuxUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36";

puppeteer.use(StealthPlugin());
(async () => {
    try {
        // const extensionPath = path.join(process.cwd(), 'my-extension');
        let pageLimit = 2;
        let websiteData = [];
        const webisteCategory = "blog";
        let testNo = 1;

        const browser = await puppeteer.launch({
            headless: false,
            // args: [
            //     `--disable-extensions-except=${extensionPath}`,
            //     `--load-extension=${extensionPath}`
            // ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(linuxUserAgent);
        outerLoop: for (let pageNo = 0; pageNo <= pageLimit; pageNo++) {
            await page.goto(`https://www.webwiki.de/${webisteCategory}?page=${pageNo}`, { waitUntil: 'networkidle2' });
            // await page.goto(`https://www.webwiki.de/neueste-bewertungen/a.html?page=1`, { waitUntil: 'networkidle2' });

            await page.waitForSelector("#websitelist")
            await page.waitForSelector(".suchinfo.pull-right.hidden-xs")
            const links = await page.$$eval(".domaintitle > a", el => {
                return el.map((val) => val.innerText)
            });

            const allPages = await page.$eval(".suchinfo.pull-right.hidden-xs", el => el.innerText);
            const totalPages = allPages.match(/\d+$/)[0];
            pageLimit = totalPages;

            for (const link of links) {
                console.log(testNo);
                testNo++;

                const websitePage = await browser.newPage();
                await websitePage.setUserAgent(linuxUserAgent);

                // await websitePage.goto(`https://timesofindia.indiatimes.com/`, { waitUntil: 'networkidle2' });
                try {
                    // await websitePage.goto(`https://www.bloggeralarm.com/`, { waitUntil: 'networkidle2' });
                    await websitePage.goto(`https://www.${link}`, { waitUntil: 'networkidle2' });
                    // await websitePage.goto(`http://aura-naturaromen.de/`, { waitUntil: 'domcontentloaded', timeout: 10000 });
                } catch (error) { }

                // if (websiteResponse && websiteResponse.status() === 200) {
                //     console.log(websiteResponse.status())
                await websitePage.waitForSelector("body")

                const elementCount = await websitePage.evaluate(() => {
                    return document.body.querySelectorAll('*').length;
                });

                if (elementCount > 30) {

                    const lastUpdatedDate = await websitePage.evaluate(() => {
                        const metaTag = document.querySelector('meta[property="article:modified_time"]');
                        return metaTag ? metaTag.getAttribute('content') : null;
                    });

                    const inputDate = new Date(lastUpdatedDate);
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
                            const trafficData = jsonData["EstimatedMonthlyVisits"]["2024-10-01"];

                            if (trafficData <= 10000) {
                                websiteData.push({
                                    name: link,
                                    monthly_viewers: trafficData,
                                    last_updated: lastUpdatedDate.split("T")[0],
                                    website: `https://www.${link}`
                                })
                            }
                            await trafficPage.close();
                            // console.log('No active AdSense account detected on the website.');
                        }
                        console.log(`current data length = ${websiteData.length}`)
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                    if (websiteData.length >= 5) {

                        break outerLoop;
                    }
                }
                await websitePage.close();
            }
            if (websiteData.length > 0) {
                makeExcelFile(websiteData);
            }
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
})();

function makeExcelFile(websiteData) {
    const writer = csvWriter.createObjectCsvWriter({
        path: 'website_data.csv',
        header: [
            { id: 'name', title: 'Name' },
            { id: 'monthly_viewers', title: 'Viewers' },
            { id: 'last_updated', title: 'Last Updated' },
            { id: 'url', title: 'URL' },
        ]
    });

    const formattedData = websiteData.map(item => ({
        ...item,
        url: `=HYPERLINK("${item.website}", "${item.website}")`
    }));

    writer.writeRecords(formattedData)
        .then(() => {
            console.log('CSV file written successfully');
        })
        .catch(err => {
            console.error('Error writing CSV file:', err);
        });
}
//