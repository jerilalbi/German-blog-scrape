import { appendCSV, createCSV, readCSVFile } from "./csvOp.js";

export const redandancyCheck = async (filname) => {
    const currentData = await readCSVFile(filname);
    const firstData = await readCSVFile("website_data_sample.csv");
    const secondData = await readCSVFile("website_data2.csv");
    const totalData = [...firstData, ...secondData];
    const currentDataSet = new Set(totalData.map(row => row.name));
    // const currentDataSet = new Set();
    const common = [];
    const unique = [];

    currentData.forEach(row => {
        if (currentDataSet.has(row.name)) {
            common.push(row);
        } else {
            unique.push({
                name: row.name,
                avg_traffic: row.avg_traffic,
                link: row.link,
                email: row.email
            });
            currentDataSet.add(row.name);
        }
    })
    // const currentDataSet = new Set(currentData.map(row => JSON.stringify(row.Name)));
    // const common = currentData.filter(row => currentDataSet.has(JSON.stringify(row.Name)));

    if (common.length > 0) {
        console.log('Common Entries:', common);
        console.log(common.length);
        // console.log(unique)
    } else {
        console.log('No common entries found.');
    }
    await createCSV(unique, '75_website_data.csv');
}

async function addName() {
    const data = await readCSVFile("75_website_data.csv");
    const newData = [];

    data.forEach(row => {
        const { hostname } = new URL(row.link);
        const name = hostname.replace(/^www\./, '');
        newData.push({
            link: row.link.trim(),
            traffic: row.traffic.trim(),
            lastModDate: row.lastModDate.trim(),
            name: name
        })
    })

    await createCSV(newData, 'New_75_website_data.csv');
}

async function addSpace(filename) {
    const data = await readCSVFile(filename);
    console.log(data);
    const newData = [];
    data.map(row => {
        newData.push({
            link: row.link + " ",
            traffic: row.traffic + " ",
            lastModDate: row.lastModDate + "",
            name: row.name + ""
        })
    })
    await createCSV(newData, '75_website_data.csv');
}