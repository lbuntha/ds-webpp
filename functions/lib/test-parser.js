"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const paywayParser_service_1 = require("./services/paywayParser.service");
const testCases = [
    // 1. Standard with APV
    "$35.00 paid by MIN KIMNAT (*356) on Jan 05, 12:00 PM via ABA PAY at DS by S.ORN DS004. Trx. ID: 176758922279389, APV: 662198.",
    // 2. Complex VIA with parens
    "$28.00 paid by Math Khorfas (*717) on Jan 05, 12:16 PM via ABA KHQR (ACLBKHPPXXX) at DS by S.ORN DS004. Trx. ID: 176759020974072, APV: 265335.",
    // 3. KHR currency
    "៛56,000 paid by ROEUN SAVY (*105) on Jan 05, 12:46 PM via ABA KHQR (ACLEDA Bank Plc.) at DS by S.ORN DS004. Trx. ID: 176759198559976, APV: 752713.",
    // 4. Broken/Manual example
    "$53.00 paid by NEANG SAMAN (*750) on Jan 06, 12:30 PM via ABA PAY at DS by S.ORN DS004. Trx. ID: 176767740944254, APV: 368680.",
    // 5. Remark field inserted
    "$20.00 paid by EK VATANAK AND Y NOU (*888) on Jan 06, 11:42 AM via ABA PAY at DS by S.ORN DS004. Remark: ឆ្នាំអស់ចេញចោលកាត់. Trx. ID: 176767455240322, APV: 837184."
];
async function run() {
    console.log("Running Parser Tests...\n");
    testCases.forEach((text, index) => {
        console.log(`Test Case ${index + 1}:`);
        console.log(`Input: "${text}"`);
        const result = paywayParser_service_1.PayWayParser.parse(text);
        if (result) {
            console.log("✅ Parsed Successfully:");
            console.log(JSON.stringify(result, null, 2));
        }
        else {
            console.log("❌ FAILED to Parse");
        }
        console.log("-".repeat(50));
    });
}
run();
//# sourceMappingURL=test-parser.js.map