// import axios from "axios";

import axios from 'axios';

// const DatabaseApi = axios.create({
//     baseURL: process.env.DB_API,
//     headers: {
//         "x-api-key": process.env.DB_API_TOKEN || "",
//     },
// })

// const ServerApi = axios.create({
//     baseURL: process.env.SERVER_API
// })

export const GoogleSearch = axios.create({
	baseURL: 'https://proxy.oyintare.dev/gsearch/',
});

export class FilesApi extends 

// export {
//     DatabaseApi,
//     ServerApi
// }
