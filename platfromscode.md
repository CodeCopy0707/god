(async () => {
    const url = "https://api.gmpay.wiki/xxapi/buyitoken/waitpayerpaymentslip?page=1&limit=50&if_asc=false&min_amount=10000&max_amount=100000&method=1&date_asc=0"
    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*",
                "indiatoken": "61a477898020403189315e5eebc247bf",
                "origin": "https://web.gmpay.wiki",
                "referer": "https://web.gmpay.wiki/"
            }
        });

        const json = await res.json();

        if (json.code !== 0) {
            console.error("API Error:", json.msg);
            return;
        }

        const orders = json.data.list;

        // clean formatted output
        const formatted = orders.map(o => ({
            orderNo: o.orderNo,
            amount: o.amount,
            realAmount: o.realAmount,
            accountNumber: o.acctNo,
            IFSC: o.acctCode,
            accountName: o.acctName,
            user: o.userId,
            rptNo: o.rptNo,
            status: o.orderState,
            createdAt: new Date(o.crtDate * 1000).toLocaleString()
        }));

        console.table(formatted);

        // full raw dump if needed
        window.ordersData = formatted;

    } catch (err) {
        console.error("Fetch failed:", err);
    }
})(); 

(async () => {
    try {
        const res = await fetch("https://api.goldensizzle.com/investment-products?page_num=1&page_size=10&type=all&sort_by=desc", {
            method: "GET",
            headers: {
                "accept": "*/*",
                "accept-language": "en",
                "authorization": "Bearer 194795|8opGZyoVc5AkvgdmcSwnGWDZOm3iw7kp3zIaEu1r",
                "content-type": "application/json",
                "origin": "https://ynwww.goldensizzle.com",
                "referer": "https://ynwww.goldensizzle.com/",
                "sec-ch-ua": `"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"`,
                "sec-ch-ua-mobile": "?1",
                "sec-ch-ua-platform": `"Android"`,
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site"
            }
        });

        const data = await res.json();

        console.log("FULL RESPONSE:", data);

        if (data?.data?.products?.length) {
            data.data.products.forEach((order, i) => {
                console.log(`\n🧾 ORDER #${i + 1}`);
                console.log("Name:", order.name);
                console.log("IFSC:", order.ifsc);
                console.log("Account:", order.account_name);
                console.log("UPI:", order.upi_account);
                console.log("Order No:", order.order_no);
                console.log("Amount:", order.amount);
                console.log("Status:", order.status);
                console.log("Created:", order.created_at);
                console.log("RAW:", order);
            });
        } else {
            console.log("No orders found");
        }

    } catch (err) {
        console.error("Error:", err);
    }
})();

(async () => {
    const BASE_URL = "https://api.crelyn.xyz/xxapi/buyitoken/waitpayerpaymentslip";
    const PAGE_SIZE = 50;

    const seenOrders = new Set();
    let isFetching = false;

    const sleep = (ms) => new Promise(res => setTimeout(res, ms));

    function isSBIorAIRP(ifsc = "") {
        const code = ifsc.toUpperCase();
        return (
            code.startsWith("SBIN") ||
            code === "AIRP0000001"
        );
    }

    function buildUrl(page) {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(PAGE_SIZE),
            if_asc: "false",
            min_amount: "10000",
            max_amount: "100000",
            method: "1",
            date_asc: "0"
        });

        return `${BASE_URL}?${params.toString()}`;
    }

    async function fetchPage(page) {
        const res = await fetch(buildUrl(page), {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*",
                "indiatoken": "2c63395f949142939593689555da600a",
                "origin": "https://api.crelyn.xyz",
                "referer": "https://api.crelyn.xyz/"
            }
        });

        const json = await res.json();

        if (json.code !== 0) {
            console.error("API Error:", json);
            return [];
        }

        return json?.data?.list || [];
    }

    async function fetchOrders() {
        if (isFetching) return;
        isFetching = true;

        try {
            const collected = [];
            const MAX_PAGES = 5;

            for (let page = 1; page <= MAX_PAGES; page++) {
                const orders = await fetchPage(page);

                if (!orders.length) break;

                const filtered = orders.filter(o =>
                    Number(o.orderState) === 0 &&
                    isSBIorAIRP(o.acctCode)
                );

                for (const o of filtered) {
                    if (!seenOrders.has(o.orderNo)) {
                        collected.push(o);
                    }
                }

                if (orders.length < PAGE_SIZE) break;
            }

            if (!collected.length) {
                console.log(`[${new Date().toLocaleTimeString()}] No SBI/AIRP orders`);
                return;
            }

            collected.sort((a, b) => (a.crtDate || 0) - (b.crtDate || 0));

            console.log(`\n🆕 ${collected.length} NEW SBI/AIRP ORDERS\n`);

            for (const o of collected) {
                seenOrders.add(o.orderNo);

                console.log("====================================");
                console.log(`🏦 IFSC: ${o.acctCode}`);
                console.log(`🧾 Order: ${o.orderNo}`);
                console.log(`💰 Amount: ${o.amount}`);
                console.log(`🎁 Reward: ${o.reward}`);
                console.log(`🏦 Account: ${o.acctNo}`);
                console.log(`👤 Name: ${o.acctName}`);
                console.log(`📌 Status: ${o.orderState}`);
                console.log(`⏱ Time: ${new Date(o.crtDate * 1000).toLocaleString()}`);
                console.log("====================================\n");

                await sleep(1700); // anti-spam delay
            }

        } catch (err) {
            console.error("❌ Fetch Error:", err);
        } finally {
            isFetching = false;
        }
    }

    // 🔁 Reset for realtime feel
    setInterval(() => {
        seenOrders.clear();
        console.log("♻️ Reset (realtime mode)");
    }, 30000);

    console.log("🚀 CRELYN SBI + AIRP realtime tracking started");

    await fetchOrders();

    // ⚡ Fast polling
    setInterval(fetchOrders, 4000);
})();

(async () => {
    try {
        const res = await fetch("https://api.linkpay.homes/xxapi/buyitoken/waitpayerpaymentslip?page=1&limit=50&if_asc=false&min_amount=1000&max_amount=100000&method=0&date_asc=0", {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*",
                "indiatoken": "9c698158df1745b29e13b5289d9d811c",
                "origin": "https://api.linkpay.homes",
                "referer": "https://api.linkpay.homes/"
            }
        });

        const data = await res.json();

        console.log("FULL RESPONSE:", data);

        if (data?.data?.list?.length) {
            data.data.list.forEach((order, i) => {
                console.log(`\n💸 ORDER #${i + 1}`);
                console.log("Order No:", order.orderNo);
                console.log("Name:", order.acctName);
                console.log("Account No:", order.acctNo);
                console.log("IFSC:", order.acctCode);
                console.log("Amount:", order.amount);
                console.log("Reward:", order.reward);
                console.log("Status:", order.orderState);
                console.log("Created:", new Date(order.crtDate * 1000).toLocaleString());
                console.log("RAW:", order);
            });
        } else {
            console.log("No orders found");
        }

    } catch (err) {
        console.error("Error:", err);
    }
})();

(async () => {
    const url = "https://api.gronix.xyz/xxapi/buyitoken/waitpayerpaymentslip?page=1&limit=50&if_asc=true&min_amount=100&max_amount=100000&method=1&date_asc=0";

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*",
                "indiatoken": "f6e5527b413948f0a01092e71778c8bc",
                "origin": "https://milesm.skin",
                "referer": "https://milesm.skin/"
            }
        });

        const json = await res.json();

        if (json.code !== 0) {
            console.error("API Error:", json.msg);
            return;
        }

        const orders = json.data.list;

        const formatted = orders.map(o => ({
            orderNo: o.orderNo,
            amount: o.amount,
            realAmount: o.realAmount,
            accountNumber: o.acctNo,
            IFSC: o.acctCode,
            accountName: o.acctName,
            user: o.userId,
            status: o.orderState,
            createdAt: new Date(o.crtDate * 1000).toLocaleString()
        }));

        console.table(formatted);

        // global access
        window.ordersData2 = formatted;

    } catch (err) {
        console.error("Fetch failed:", err);
    }
})();

(async () => {
    const url = "https://rapi.supercoinpay.com/xxapi/buyitoken/waitpayerpaymentslip?page=1&limit=50&if_asc=true&min_amount=100&max_amount=100000&method=1&date_asc=0";

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*",
                "indiatoken": "2607636946d74f5094d80b3c6c2b493c",
                "origin": "https://refer.supercoinpay.com",
                "referer": "https://refer.supercoinpay.com/"
            }
        });

        const json = await res.json();

        if (json.code !== 0) {
            console.error("API Error:", json.msg);
            return;
        }

        const orders = json.data.list;

        // clean formatted output
        const formatted = orders.map(o => ({
            orderNo: o.orderNo,
            amount: o.amount,
            realAmount: o.realAmount,
            accountNumber: o.acctNo,
            IFSC: o.acctCode,
            accountName: o.acctName,
            user: o.userId,
            status: o.orderState,
            createdAt: new Date(o.crtDate * 1000).toLocaleString()
        }));

        console.table(formatted);

        // full raw dump if needed
        window.ordersData = formatted;

    } catch (err) {
        console.error("Fetch failed:", err);
    }
})();

(async () => {
    const CONFIG = {
        baseUrl: "https://api.kelura.xyz/xxapi/buyitoken/waitpayerpaymentslip?page=1&limit=50&if_asc=false&min_amount=100&max_amount=100000&method=1&date_asc=0",
        pageSize: 50,
        method: 1, // same as your payload
        ifAsc: false,
        dateAsc: 0,
        pollIntervalMs: 4000,
        maxPagesPerPoll: 10,   // jitni zyada page scan, utna better
        resetSeenEveryMs: 60000 // duplicate cleanup
    };

    const INDIA_TOKEN = "20e28792040b4764a2ec713c6a5625d2";
    const ORIGIN = "https://web.zippay.wiki";
    const REFERER = "https://web.zippay.wiki";

    const amountMin = 1000;
    const amountMax = 100000;

    // Comma-separated IFSC filters:
    // SBIN means prefix match for SBI
    // AIRP0000001 means exact match
    const ifscInput = (prompt(
        "IFSC filters? (comma separated, default: SBIN,AIRP0000001)",
        "SBIN,AIRP0000001"
    ) || "SBIN,AIRP0000001").trim();

    const filters = ifscInput
        .split(",")
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

    const seenOrders = new Set();
    let isFetching = false;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    function matchesIfsc(ifsc = "") {
        const code = String(ifsc).toUpperCase();

        return filters.some(f => {
            // SBIN => prefix match
            if (f === "SBIN") return code.startsWith("SBIN");
            // AIRP0000001 or other exact IFSC codes
            return code === f;
        });
    }

    function buildUrl(page) {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(CONFIG.pageSize),
            if_asc: String(CONFIG.ifAsc),
            min_amount: String(amountMin),
            max_amount: String(amountMax),
            method: String(CONFIG.method),
            date_asc: String(CONFIG.dateAsc)
        });

        return `${CONFIG.baseUrl}?${params.toString()}`;
    }

    async function fetchPage(page) {
        const res = await fetch(buildUrl(page), {
            method: "GET",
            headers: {
                "accept": "application/json, text/plain, */*",
                "indiatoken": INDIA_TOKEN,
                "origin": ORIGIN,
                "referer": REFERER
            }
        });

        const json = await res.json();

        if (json?.code !== 0) {
            console.error("API Error:", json);
            return [];
        }

        return json?.data?.list || [];
    }

    function printOrder(order) {
        console.log("====================================");
        console.log(`🏦 IFSC: ${order.acctCode}`);
        console.log(`🧾 Order No: ${order.orderNo}`);
        console.log(`💰 Amount: ${order.amount}`);
        console.log(`🎁 Reward: ${order.reward}`);
        console.log(`🏦 Account: ${order.acctNo}`);
        console.log(`👤 Name: ${order.acctName}`);
        console.log(`📌 Status: ${order.orderState}`);
        console.log(`⏱ Time: ${new Date(order.crtDate * 1000).toLocaleString()}`);
        console.log("RAW:", order);
        console.log("====================================\n");
    }

    async function scanOnce() {
        if (isFetching) return;
        isFetching = true;

        try {
            const matched = [];

            for (let page = 1; page <= CONFIG.maxPagesPerPoll; page++) {
                const orders = await fetchPage(page);

                if (!orders.length) break;

                for (const order of orders) {
                    const amount = Number(order.amount || 0);
                    const orderState = Number(order.orderState || 0);

                    if (
                        orderState === 0 &&
                        amount >= amountMin &&
                        amount <= amountMax &&
                        matchesIfsc(order.acctCode)
                    ) {
                        if (!seenOrders.has(order.orderNo)) {
                            matched.push(order);
                        }
                    }
                }

                // last page reached
                if (orders.length < CONFIG.pageSize) break;
            }

            if (!matched.length) {
                console.log(`[${new Date().toLocaleTimeString()}] No matching SBI/AIRP orders`);
                return;
            }

            // newest first
            matched.sort((a, b) => (b.crtDate || 0) - (a.crtDate || 0));

            console.log(`\n🆕 ${matched.length} NEW MATCHING ORDERS\n`);

            for (const order of matched) {
                seenOrders.add(order.orderNo);
                printOrder(order);
                await sleep(300);
            }
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            isFetching = false;
        }
    }

    console.log("🚀 Realtime tracker started");
    console.log("Filters:", filters.join(", "));
    console.log("Amount range:", amountMin, "-", amountMax);

    await scanOnce();

    setInterval(scanOnce, CONFIG.pollIntervalMs);

    setInterval(() => {
        seenOrders.clear();
        console.log("♻️ Seen cache cleared");
    }, CONFIG.resetSeenEveryMs);
})();

(() => {
    const API_URL = "https://api.plavix.skin/xxapi/buyitoken/waitpayerpaymentslip";

    const headers = {
        "accept": "application/json, text/plain, */*",
        "indiatoken": "b108a059945a463c8cf83330e87a0e17"
    };

    let seenOrders = new Set();

    async function fetchOrders() {
        try {
            const url = `${API_URL}?page=1&limit=50&if_asc=false&min_amount=5000&max_amount=100000&method=1&date_asc=0`;

            const res = await fetch(url, {
                method: "GET",
                headers
            });

            const data = await res.json();

            if (data.code === 0 && data.data?.list) {
                data.data.list.forEach(order => {
                    if (!seenOrders.has(order.orderNo)) {
                        seenOrders.add(order.orderNo);

                        console.log("🆕 NEW ORDER:", {
                            orderNo: order.orderNo,
                            amount: order.amount,
                            name: order.acctName,
                            account: order.acctNo,
                            ifsc: order.acctCode
                        });
                    }
                });
            }

        } catch (err) {
            console.error("❌ Error:", err);
        }
    }

    // run instantly
    fetchOrders();

    // repeat every 3 seconds
    setInterval(fetchOrders, 3000);
})();