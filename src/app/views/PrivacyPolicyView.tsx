import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';

export const PrivacyPolicyView: React.FC = () => {
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
                <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Privacy Policy</h1>
                <p className="text-slate-500 mb-10">Last modified: February 14th, 2020</p>

                <div className="prose prose-slate max-w-none text-slate-600 leading-relaxed">
                    <p className="mb-8">
                        Doorstep Technology is committed to protecting and respecting your privacy. This Privacy Policy sets out how we collect and process personal information about you when you visit the website www.doorsteps.tech or our app in Apple Store or Google Play, when you use our products and services (our "Services"), or when you otherwise do business or make contact with us.
                    </p>
                    <p className="mb-8 font-medium text-slate-900">
                        Please read this policy carefully to understand how we handle and treat your personal information.
                    </p>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">What information do we collect?</h2>
                        <p className="mb-4">We may collect and process the following personal information from you:</p>
                        <div className="space-y-4">
                            <p><strong>Information you provide to us:</strong> We collect personal information when you voluntarily provide us with such information in the course of using our website, app or Services. For example, when you register to use our Services, we will collect your name, email address and organization information. We also collect personal information from you when you respond to a survey.</p>
                            <p><strong>Information we collect when you do business with us:</strong> We may process your personal information when you do business with us – for example, as a customer or prospective customer, or as a vendor, supplier, or other third party. For example, we may hold your business contact information and financial account information (if any) and other communications you have with us for the purposes of maintaining our business relations with you.</p>
                            <p><strong>Information we automatically collect:</strong> We may also collect certain technical information by automatic means when you visit our website and app, such as IP address, browser type and operating system, current location, referring URLs, your use of our website, and other clickstream data. We collect this information automatically through the use of various technologies, such as cookies.</p>
                            <p><strong>Personal information where we act as a data processor:</strong> We also process personal information on behalf of our customers in the context of supporting our products and services. Where a customer subscribes to our Services for their businesses, they will be the ones who control what event data is collected and stored on our systems. In such cases, we are data processors acting in accordance with the instructions of our customers.</p>
                        </div>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">What do we use your information for?</h2>
                        <p className="mb-4">The personal information we collect from you may be used in one of the following ways:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>To deal with your inquiries and requests</li>
                            <li>To create and administer records about any online account that you register with us</li>
                            <li>To provide you with information and access to resources that you have requested from us</li>
                            <li>To provide you with technical support</li>
                            <li>To improve our website and app based on the information and feedback we receive from you</li>
                            <li>For website, app, and system administration and security</li>
                            <li>For general business purposes, including to improve customer service</li>
                            <li>To process transactions and to provide Services to our customers and end-users</li>
                            <li>For recruitment purposes, where you apply for a job with us</li>
                            <li>To administer a contest, promotion, survey, or other site and app features</li>
                            <li>To send periodic emails pertaining to your orders and updates</li>
                        </ul>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">How do we protect your information?</h2>
                        <p>We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information. We offer the use of a secure server. All supplied sensitive/credit information is transmitted via Secure Socket Layer (SSL) technology and then encrypted into our Payment gateway providers database only to be accessible by those authorized with special access rights to such systems, and are required to keep the information confidential. After a transaction, your private information (credit cards, identification, financials, etc.) will not be stored on our servers.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Do we use cookies?</h2>
                        <p className="mb-4">Yes. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser (if you allow) that enables the sites or service providers systems to recognize your browser and capture and remember certain information.</p>
                        <p className="mb-4">We use cookies to understand and save your preferences for future visits, to advertise to you on other sites and compile aggregate data about site traffic and site interaction so that we can offer better site experiences and tools in the future.</p>
                        <p>You may refuse to accept cookies by activating the setting on your browser which allows you to refuse the setting of cookies. However, if you choose to disable cookies, you may be unable to access certain parts of our site.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Do we disclose any information to outside parties?</h2>
                        <p className="mb-4">We will only share your information with third parties in certain circumstances:</p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                            <li>We engage certain trusted third parties to perform functions and provide services to us, including cloud hosting services, off-site backups, email service providers, and customer support providers.</li>
                            <li>In the event of a corporate sale, merger, reorganization, dissolution or similar event, your personal information may be sold, disposed of, transferred or otherwise disclosed as part of that transaction.</li>
                            <li>We may also disclose information about you to third parties where we believe it necessary or appropriate under law.</li>
                            <li>We may use and share aggregated non-personal information with third parties for marketing, advertising and analytics purposes.</li>
                        </ul>
                        <p className="mt-4 font-medium text-slate-900">We do not sell or trade your personal information to third parties.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Third Party Links</h2>
                        <p>Occasionally, at our discretion, we may include or offer third party products or services on our website. If you access other websites using the links provided, the operators of these websites may collect information from you that will be used by them in accordance with their privacy policies. These third party sites have separate and independent privacy policies. We therefore have no responsibility or liability for the content and activities of these linked sites.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">International Transfers</h2>
                        <p>If you are visiting our website or using our Services from outside Cambodia, please be aware that you are sending personal information to Cambodia where our servers are located. Cambodia may not have data protection laws that are as comprehensive or protective as those in your country of residence; however, our collection, storage and use of your personal information will at all times be in accordance with this Privacy Policy.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Your Rights</h2>
                        <p className="mb-4">You may have the right to access a copy of the personal information we hold about you, or to request the correction, amendment or deletion of such information where it is inaccurate or processed in violation of the Privacy Shield Principles.</p>
                        <p>Furthermore, we commit to giving you an opportunity to opt-out if your personal information is to be disclosed to any other independent third parties, or to be used for a purpose materially different from those that are set out in this Privacy Policy. Where sensitive personal information is involved, we will always obtain your express opt-in consent.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Data Retention</h2>
                        <p className="mb-4">We may retain your personal information as long as you continue to use the Services, have an account with us or for as long as is necessary to fulfil the purposes outlined in the policy. You can ask to close your account by contacting us and we will delete your personal information on request.</p>
                        <p>We may however retain personal information for an additional period as is permitted or required under applicable laws, for legal, tax or regulatory reasons, or for legitimate and lawful business purposes.</p>
                    </section>

                    <section className="mb-10">
                        <h2 className="text-xl font-bold text-slate-900 mb-4">Changes to our Privacy Policy</h2>
                        <p>If we decide to change our privacy policy, we will post those changes on this page, and/or update the Privacy Policy modification date above.</p>
                    </section>

                    <div className="mt-12 p-6 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-sm text-slate-600">
                            For questions about this Privacy Policy, please contact us at{' '}
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

export default PrivacyPolicyView;
