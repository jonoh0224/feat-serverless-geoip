#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { QuickAndDirtyServerlessGeoipApiStack } from "../lib/quick-and-dirty-serverless-geoip-api-stack";

import * as os from "os";
import * as path from "path";
import * as https from "https";
import * as fs from "fs";
import * as decompress from "decompress";
import { URL } from "url";

const app = new cdk.App();

// Generate a YYYYMMDD date stamp to use in the filename of the temp downloaded MaxMind GeoLite2 City database
const dateStamp =
  new Date().getFullYear() + // Year
  ("0" + (new Date().getMonth() + 1)).slice(-2) + // Month
  ("0" + new Date().getDate()).slice(-2); // Day
const tempCityDatabaseDownloadFileName = `${fs.mkdtempSync(
  path.join(os.tmpdir(), "qdsgeoipapi-")
)}/GeoLite2-City_${dateStamp}.tar.gz`;

// Function to handle download and follow redirects if necessary
function downloadFile(
  url: string | https.RequestOptions | URL | undefined,
  outputPath: fs.PathLike,
  callback: { (): void; (): void }
) {
  https
    .get(url as string, (response) => {
      console.log(`Status Code for download: ${response.statusCode}`);
      if (response.statusCode === 302 || response.statusCode === 301) {
        // If redirected, download from the new location
        const newUrl = response.headers.location;
        console.log(`Redirected to ${newUrl}`);
        downloadFile(newUrl, outputPath, callback);
      } else if (response.statusCode === 200) {
        // If successfully responded, write the file
        const fileStream = fs.createWriteStream(outputPath);
        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close();
          console.log("Download Completed");
          callback(); // Call the callback function once download is complete
        });
      } else {
        console.error(
          `Download failed with status code: ${response.statusCode}`
        );
      }
    })
    .on("error", (err) => {
      console.error("Download Error:", err);
    });
}

// Start the download
console.log(
  `Retrieving compressed MaxMind GeoLite2 City database to ${tempCityDatabaseDownloadFileName} ...`
);
downloadFile(
  `https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${app.node.tryGetContext(
    "maxMindLicenseKey"
  )}&suffix=tar.gz`,
  tempCityDatabaseDownloadFileName,
  () => {
    // Extract the downloaded MaxMind GeoLite2 City database after download
    console.log(
      `Extracting MaxMind GeoLite2 City database to ../lambda/GeoLite2-City.mmdb ...`
    );
    decompress(
      tempCityDatabaseDownloadFileName,
      path.join(__dirname, "../lambda"),
      {
        filter: (file) => path.extname(file.path) === ".mmdb",
        strip: 1,
      }
    )
      .then((files) => {
        console.log("Extracted files:", files);
        // Initialize the AWS CDK stack after the database is extracted
        new QuickAndDirtyServerlessGeoipApiStack(
          app,
          "QuickAndDirtyServerlessGeoipApiStack"
        );
      })
      .catch((error) => {
        console.error("Decompression error:", error);
      });
  }
);
