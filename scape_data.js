const path = require('path');
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const csvWriter = require('csv-writer');
const axios = require('axios');
const { parseStringPromise } = require('xml2js');
const { timeout } = require('puppeteer');

const linuxUserAgent = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36";

puppeteer.use(StealthPlugin());
(async () => {
    try {
        // const extensionPath = path.join(process.cwd(), 'my-extension');
        let pageLimit = 10000;
        let websiteData = [];
        const webisteCategory = "blog";
        let testNo = 1;

        const browser = await puppeteer.launch({
            // headless: "new",
            headless: false,
            // args: [
            //     `--disable-extensions-except=${extensionPath}`,
            //     `--load-extension=${extensionPath}`
            // ]
        });

        const page = await browser.newPage();
        await page.setUserAgent(linuxUserAgent);
        outerLoop: for (let pageNo = 3251; pageNo <= pageLimit; pageNo++) {
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

                        if (elementCount > 30) {

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
})();

function makeExcelFile(websiteData) {

    // const filePath = 'website_data.csv';

    // const fileExists = fs.existsSync(filePath);

    const writer = csvWriter.createObjectCsvWriter({
        path: 'website_data_sample.csv',
        header:
            [
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

// change https://www.dia-blog.de/ - 6, 8, 10, 11, 12, 15, 20 solved
// https://www.skoda-portal.de/
// https://karminrot-blog.de/
// https://kielfeder-blog.de/
// https://www.yourdealz.de/
// https://out-takes.de/
// https://www.hh-gruppe.de/
//https://fairwertung.de/
// https://www.abmahnung.de/
// https://www.rgf.de/de/home/
// https://www.bellaswonderworld.de/blog/
// https://o-tonart.de/category/blog/
// https://www.conventionbureau-karlsruhe.de/
// https://www.centigrade.de/de/blog/
// https://www.sem-deutschland.de/
// https://www.amperpark.de/
// https://www.geizstudent.de/blog/
// https://www.personal-wissen.de/
// https://www.dtms.de/
// https://karriere-und-bildung.de/
// https://anstiftung.de/
// https://silvesterlauf.de/
// https://www.savills.de/
// https://www.flowbirthing.de/
// https://innocenceindanger.de/blog/
// https://textil-mode.de/de/ - 70
// https://www.indesign-blog.de/
// https://www.telefontraining-claudiafischer.de/
// https://www.metahr.de/
// https://www.freiberufler-blog.de/
// https://www.christagoede.de/
// https://www.sepago.de/en/home/
// https://www.spike05.de/
// https://www.reisebineblog.de/
// https://www.rss-blog.de/
// https://www.freilichtbuehne-nettelstedt.de/
// https://www.crossgolf.de/
// https://www.der-hammerwirt.de/
// https://ghostwriter-blog.de/
// https://dotcomblog.de/
// https://eineweltblabla.de/
// https://www.arminkoenig.de/
// https://www.domus-software.de/
// https://www.lemm.de/
// https://www.der-wirtschaftspruefungs-blog.de/
// https://dgl-online.de/
// https://sosimmer.de/
// https://www.jungundaltspielt.de/
// https://evs-blog.de/
// https://www.radkultur-bw.de/ --- upto solved

//https://dmsg-niedersachsen.de/
// https://www.alexfuerst.de/
//https://initiative-gegen-die-todesstrafe.de/
// https://www.schiller-buch.de/
// https://seo.de/
// https://muk-blog.de/
// https://www.bleiben-sie-sicher.de/  -- upto solved

//https://www.nepomucenum.de/
// https://www.bahnhofsvision.de/
// https://www.buerodienste-in.de/
// https://www.definition-von-fett.de/
// https://www.philipp-poisel.de/
// https://www.gge-blog.de/
//https://profashionals.de/
// https://apotheke-bergkamen.de/
// https://www.junge-selbsthilfe-blog.de/
// https://www.burgerbe.de/
// https://www.kallebaecker.de/
// https://www.benutzerfreun.de/
// https://fosteringinnovation.de/
// https://watchthusiast.de/
//https://www.unternehmer-impulse.de/
// https://songtexte-schreiben-lernen.de/blog/ -- solved



// Finished - upto 35 .... pages check = 460

// 101 - 56

// Wed, 12 Jul 2017

// final csv checked - 64