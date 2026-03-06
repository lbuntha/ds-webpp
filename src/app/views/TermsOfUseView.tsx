import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';

export const TermsOfUseView: React.FC = () => {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-red-100 selection:text-red-900">
            <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md shadow-sm py-3">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/landing')}>
                            <img src="/logo/icon.png" alt="Doorstep" className="h-7 w-auto object-contain" />
                            <span className="text-2xl font-bold tracking-tight text-slate-900">Doorstep</span>
                        </div>
                        <Button onClick={() => navigate('/landing')} className="bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200">
                            Back to Home
                        </Button>
                    </div>
                </div>
            </nav>

            <div className="pt-32 pb-20 max-w-4xl mx-auto px-6">
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Terms and Conditions</h1>
                <p className="text-slate-500 mb-10">Last modified: February 14th, 2020</p>

                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                    <p className="mb-8">
                        The following terms ("Terms of Service") describe the terms and conditions applicable to your access to and use of the Services, as such term is defined in Section 1 below. This document is a legally binding agreement between you as the user of the Services (referred to as "you" or "your") and DoorStep and its Affiliates, where applicable (referred to as "we", "our", "us" or "DoorStep").
                    </p>
                    <p className="mb-8">
                        By signing up for the Services you are agreeing to be bound by these Terms of Service and any documents incorporated by reference. Any new features or tools that are added to the current Services shall also be subject to these Terms of Service.
                    </p>
                    <p className="mb-8 font-medium text-slate-900">
                        You must read, agree with and accept all of the terms and conditions contained and incorporated by reference in these Terms of Service.
                    </p>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">1. General Conditions</h2>
                        <div className="space-y-4">
                            <p><strong>1.1</strong> The Services assist you in managing your business by providing an online marketplace through the DoorStep application that enables you to sale your Products and fulfil via drop-shipping to your Buyers. DoorStep has no control over, and will not be responsible or liable for: (a) any Products or Third Party Services you interact with, access, purchase or procure from Suppliers or other third parties; or (b) any liability arising out of any transactions between you and third parties, including between you and Suppliers or your Buyers.</p>
                            <p><strong>1.2</strong> In order to use the Services, you must at all times comply with these Terms of Service, the Policies, and any other operating rules, policies, guidelines and/or procedures that are incorporated by reference into such documents or that DoorStep communicates to you from time to time. Your failure to do so may result in an immediate suspension and/or termination of this Agreement and your use of the Services.</p>
                            <p><strong>1.3</strong> You must be 18 years or older or at least the age of majority in the jurisdiction where you reside or from which you use the Services.</p>
                            <p><strong>1.4</strong> You acknowledge and agree that the Services, including without limitation, any associated software, documentation, applications, websites, tools and products, any modifications, enhancements and updates thereto, and all intellectual property rights therein are exclusively owned by DoorStep.</p>
                            <p><strong>1.5</strong> You acknowledge and agree that we may amend these Terms of Service at any time by posting the relevant amended and restated Terms of Service here and such amendments are effective as of the date of posting. Your continued use of the Services after the amended Terms of Service are posted constitutes your agreement to, and acceptance of, the amended Terms of Service.</p>
                            <p><strong>1.6</strong> You may not use the Services for any illegal, fraudulent or unauthorized purpose nor may you, in the use of the Services, violate any laws in your jurisdiction, the laws in your Buyer's jurisdiction, or the laws of Kingdom of Cambodia.</p>
                            <p><strong>1.7</strong> You agree not to reproduce, duplicate, copy, sell, resell or exploit any portion of the Services, use of the Services, or access to the Services without our express written permission.</p>
                            <p><strong>1.8</strong> The Terms of Service may be available in languages other than English. To the extent of any inconsistencies or conflicts between these English Terms of Service and Terms of Service available in another language, the most current English version shall prevail.</p>
                            <p><strong>1.9</strong> Questions about these Terms of Service should be sent to <a href="mailto:info@DoorSteps.tech" className="text-red-600 hover:underline">info@DoorSteps.tech</a>.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">2. Account Requirements</h2>
                        <div className="space-y-4">
                            <p><strong>2.1</strong> In order to use the Services, you must register for and maintain an active DoorStep account ("DoorStep Account") and provide certain information including your email address and any other information identified as being required. You agree to maintain accurate, complete, and up-to-date information for your DoorStep Account.</p>
                            <p><strong>2.2</strong> You are responsible for all activity and content, such as photos, images, videos, graphics, written content, audio files, code, information, or data uploaded, collected, generated, stored, displayed, distributed, transmitted or exhibited on or in connection with your DoorStep Account and your use of the Services.</p>
                            <p><strong>2.3</strong> You agree to maintain the security and secrecy of your DoorStep Account password(s) at all times. You must promptly notify DoorStep if you become aware of or reasonably suspect any security breach. DoorStep cannot and will not be liable for any loss or damage from your failure to maintain the security of your DoorStep Account and password.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">3. Our Rights</h2>
                        <div className="space-y-4">
                            <p><strong>3.1</strong> We reserve the right to modify (including but not limited to adding or removing features), discontinue or terminate the Services or any part thereof, or terminate your DoorStep Account or your access to the Services, for any reason without notice at any time.</p>
                            <p><strong>3.2</strong> We reserve the right to refuse the Services to anyone for any reason at any time. We may exercise this right on a case-by-case basis.</p>
                            <p><strong>3.3</strong> We may, but have no obligation to, remove without notice any Content or Comments that we determine in our sole discretion violate these Terms of Service, any third party's intellectual property, or any applicable laws or regulations.</p>
                            <p><strong>3.4</strong> Verbal or written abuse of any kind (including threats of abuse or retribution) of DoorStep's employees, members, or officers will result in immediate termination.</p>
                            <p><strong>3.5</strong> We reserve the right to provide the Services and any other of our services to your competitors and make no promise of exclusivity in any particular market segment.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">4. Products and Third Party Services</h2>
                        <div className="space-y-4">
                            <p><strong>4.1</strong> You acknowledge that the Services may enable or assist you in accessing, interacting with customers to purchasing your products, including via Third Party Services. Any use by you of Third Party Services or Products made available through the Services is entirely at your own risk and discretion.</p>
                            <p><strong>4.2</strong> DoorStep may from time to time, but is not obligated to, provide access to Suppliers via additional Third Party Services.</p>
                            <p><strong>4.3</strong> In addition to these Terms of Service, you also agree to be bound by any additional service specific terms applicable to Products and Third Party Services.</p>
                            <p><strong>4.4</strong> You, and not DoorStep, are solely responsible for all of the terms and conditions of any transactions involving the sale of Products, including payment, returns, warranties, shipping, handling, transportation, storage, liability, insurance fees, applicable taxes, title and licenses.</p>
                            <p><strong>4.5</strong> Under no circumstances shall DoorStep or its Affiliates be liable for any direct, indirect, incidental, special, consequential, punitive, or other damages whatsoever, that result from any Third Party Services, Products or your relationship with any Supplier or Buyer.</p>
                            <p><strong>4.6</strong> You agree to indemnify and hold us and our Affiliates harmless from any claim or demand arising out of your use of Third Party Services or Products.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">5. Privacy and User Data</h2>
                        <p>You understand that any information you provide to us in using the Services (not including credit card information), may be transferred unencrypted and involve (a) transmissions over various networks; and (b) changes to conform and adapt to technical requirements of connecting networks or devices. Credit card information is always encrypted during transfer over networks. Any personal information you provide will be treated in accordance with our Privacy Policy.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">6. Accuracy, Completeness and Timeliness of Information</h2>
                        <div className="space-y-4">
                            <p><strong>6.1</strong> We make no warranties with respect to the information made available by the Services, and we are not responsible if that information is not accurate, complete, up-to-date or otherwise does not meet your specific requirements.</p>
                            <p><strong>6.2</strong> Occasionally there may be information that contains typographical errors, inaccuracies or omissions. We undertake no obligation to correct, update, amend or clarify such information.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">7. Intellectual Property</h2>
                        <div className="space-y-4">
                            <p><strong>7.1</strong> You grant DoorStep a limited, non-exclusive, sublicensable, royalty-free license to access, use, reproduce, electronically distribute, transmit, perform, format, display, store, archive, and index the Content for the purpose of supporting your use of the Services.</p>
                            <p><strong>7.2</strong> You are solely responsible for the Content that you upload, publish, display, link to, or otherwise make available via the Services. DoorStep retains the authority to remove any Content that it deems in violation of these Terms of Service.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">8. Fees, Settlement and Other Charges</h2>
                        <div className="space-y-4">
                            <p><strong>8.1</strong> You will pay the Fees applicable to your subscription to the Services and any other applicable charges.</p>
                            <p><strong>8.2</strong> You are responsible to pay Suppliers for any Third Party Services or Products that you purchase.</p>
                            <p><strong>8.3</strong> Fees are paid in advance and will be billed in 30 day intervals. Users have approximately fourteen (14) calendar days to bring up and settle any issues with the billing.</p>
                            <p><strong>8.4</strong> All Fees are exclusive of any applicable taxes. Taxes are based on the jurisdiction of the billing address of your DoorStep Account.</p>
                            <p><strong>8.5</strong> Applicable Fees are subject to change upon thirty (30) days' notice from DoorStep.</p>
                            <p><strong>8.6</strong> Requests for order cancellations, refunds and returns are handled in accordance with the Merchant Policy.</p>
                            <p><strong>8.7</strong> Merchant Product fee bought by consumer and delivered by DoorStep will be settled (total remaining amount after deducting service fee) on a weekly basis. The remaining amount will be directly transferred to Merchant Bank Account.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">9. User Comments, Feedback and Other Submissions</h2>
                        <p>You agree that your Comments will not violate any right of any third-party, including copyright, trademark, privacy, personality or other rights. You further agree that your Comments will not contain libelous, defamatory or otherwise unlawful, abusive, hateful or obscene material. You are solely responsible for any Comments you make and their accuracy.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">10. Prohibited Uses</h2>
                        <p className="mb-4">In addition to other prohibitions as set forth in the Terms of Service, you are prohibited from using the Services:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>For any unlawful purpose</li>
                            <li>To solicit others to perform or participate in any unlawful acts</li>
                            <li>To violate any international or local laws, rules, or regulations</li>
                            <li>To infringe upon or violate intellectual property rights</li>
                            <li>To submit false or misleading information</li>
                            <li>To upload or transmit viruses or any other type of malicious code</li>
                            <li>To collect or track the personal information of others</li>
                            <li>To spam, phish, pharm, pretext, spider, crawl, or scrape</li>
                            <li>For any obscene or immoral purpose</li>
                            <li>To interfere with or circumvent the security features of the Services</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">11. Disclaimer of Warranties; Limitation of Liability</h2>
                        <div className="space-y-4">
                            <p><strong>11.1</strong> You expressly agree that your use of, or inability to use, the Services is at your sole risk. The Services is provided "as is" and "as available" for your use, without any representation, warranties or conditions of any kind, either express, implied or statutory.</p>
                            <p><strong>11.2</strong> In no event shall DoorStep or its Affiliates be liable for any injury, loss, claim, or any direct, indirect, incidental, punitive, special, or consequential damages of any kind, including lost profits, lost revenue, lost savings, loss of data, replacement costs, or any similar damages.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">12. Indemnification</h2>
                        <p>You agree to indemnify, defend and hold harmless DoorStep and its Affiliates from any claim or demand, including reasonable attorneys' fees, made by any third-party, due to or arising out of a claim alleging that you, the Content or any Product infringes or violates the intellectual property rights, privacy rights or other rights of a third party or violates applicable law.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">13. Dispute Resolution</h2>
                        <div className="space-y-4">
                            <p><strong>13.1</strong> Any issues or disputes that arise between you and Buyer in connection with your sale or attempted sale of Products via DoorStep must be reported directly to us through the Services and will be handled in accordance with the Merchant Policy.</p>
                            <p><strong>13.2</strong> By agreeing to these Terms of Service, you agree that you are required to resolve any claim that you may have against DoorStep on an individual basis in arbitration. These Terms of Service shall be governed by and interpreted in accordance with the laws of the Kingdom of Cambodia.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">14. Termination</h2>
                        <div className="space-y-4">
                            <p><strong>14.1</strong> These Terms of Service are effective unless and until terminated by either you or us. You may terminate these Terms of Service at any time by deleting the DoorStep application or by closing your DoorStep store.</p>
                            <p><strong>14.2</strong> If in our sole judgment you fail to comply with any term or provision of these Terms of Service, we may terminate these Terms of Service at any time without notice.</p>
                            <p><strong>14.3</strong> Upon termination: (a) DoorStep will cease providing you with the Services; (b) you will not be entitled to any refunds; and (c) any outstanding balance owed will immediately become due and payable in full.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">15. Severability</h2>
                        <p>In the event that any provision of these Terms of Service is determined by a court of competent jurisdiction to be unlawful, void or unenforceable, such provision shall nonetheless be enforceable to the fullest extent permitted by applicable law, and such determination shall not affect the validity and enforceability of any other remaining provisions.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">16. Waiver and Entire Agreement</h2>
                        <div className="space-y-4">
                            <p><strong>16.1</strong> The failure by us to exercise or enforce any right or provision of these Terms of Service shall not constitute a waiver of such right or provision.</p>
                            <p><strong>16.2</strong> These Terms of Service and any documents incorporated into these Terms of Service constitutes the entire agreement and understanding between you and us, and govern your use of the Services, superseding any prior or contemporaneous agreements.</p>
                        </div>
                    </section>

                    <div className="mt-12 p-6 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm text-slate-600">
                            For questions about these Terms and Conditions, please contact us at{' '}
                            <a href="mailto:info@DoorSteps.tech" className="text-red-600 hover:underline font-medium">info@DoorSteps.tech</a>
                        </p>
                    </div>
                </div>
            </div>

            <footer className="bg-white border-t border-gray-200 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
                    &copy; {new Date().getFullYear()} Doorstep Logistics Technology. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default TermsOfUseView;
