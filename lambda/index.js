const fs = require('fs');
const Reader = require('@maxmind/geoip2-node').Reader;

// Load the GeoIP database outside of the individual Lambda executions
const dbBuffer = fs.readFileSync('./GeoLite2-City.mmdb');
const reader = Reader.openBuffer(dbBuffer);

exports.handler = async function(event) {
    console.log(event);

    // Check if this is a warmup call
    if (event.source === 'aws.events') { // Assuming the warmup event has a source or some identifying field
        console.log('Warmup call received');
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Warmup successful' })
        };
    }

    try {
        // Let's query the GeoIP DB with either the value of the "ip" query string parameter, or the requester's IP
        const geoIPLookupResponse = reader.city(
            event.queryStringParameters ? event.queryStringParameters.ip : event.ip ? event.ip : event.requestContext.http.sourceIp
        );

        // Return the result to the requestor
        return {
            statusCode: 200,
            body: JSON.stringify(geoIPLookupResponse)
        };
    } catch (error) {
        console.error('Error occurred:', error);
        // Error occurred, return an error
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An unknown error occurred while trying to resolve the IP.' })
        };
    }
};
