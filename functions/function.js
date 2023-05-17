exports.handler = async function (event) {
    console.log("Request:", JSON.stringify(event));

    return sendResponse(200, "Testing");
};

const sendResponse = (status, body) => {
    var response = {
        statusCode: status,
        headers: {
            "Content-Type": "text/html",
        },
        body: body,
    };
    return response;
};