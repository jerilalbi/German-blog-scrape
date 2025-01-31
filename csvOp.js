import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import csv from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export const appendCSV = async (data, filename) => {
    try {
        const filePath = path.join(__dirname, filename);
        const headers = Object.keys(data);
        const values = Object.values(data);
        let csvData;

        if (!fs.existsSync(filePath)) {
            csvData = headers.join(',') + '\n';
            fs.writeFileSync(filePath, csvData);
        }

        csvData = values.join(',') + '\n';
        fs.appendFileSync(filePath, csvData);

    } catch (error) {
        console.log(error.message);
    }
}

export const createCSV = async (data, filename) => {
    try {
        const filePath = path.join(__dirname, filename);
        const headers = Object.keys(data[0]).join(',');

        const values = data.map(obj =>
            Object.values(obj).join(',')
        );

        const csvData = [headers, ...values].join('\n');
        fs.writeFileSync(filePath, csvData);
    } catch (error) {
        console.log(error.message);
    }
}

export const readCSVFile = async (filePath) => {
    const results = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}