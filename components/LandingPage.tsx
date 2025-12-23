
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { useLanguage } from '../src/shared/contexts/LanguageContext';
import { toast } from '../src/shared/utils/toast';

type PageType = 'HOME' | 'ABOUT' | 'CONTACT' | 'HELP' | 'PRIVACY' | 'TERMS';

interface Props {
  onLogin?: () => void;
  onRegister?: () => void;
}

export const LandingPage: React.FC<Props> = ({ onLogin: propOnLogin, onRegister: propOnRegister }) => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState<PageType>('HOME');
  const [scrolled, setScrolled] = useState(false);

  // Use props if provided, otherwise default to navigation
  const onLogin = propOnLogin || (() => navigate('/auth/login'));
  const onRegister = propOnRegister || (() => navigate('/auth/register'));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePage]);

  const scrollToSection = (id: string) => {
    if (activePage !== 'HOME') {
      setActivePage('HOME');
      setTimeout(() => {
        const element = document.getElementById(id);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const element = document.getElementById(id);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const FeaturePill = ({ icon, text }: { icon: React.ReactNode, text: string }) => (
    <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200 text-sm font-medium text-gray-700 shadow-sm">
      {icon}
      <span>{text}</span>
    </div>
  );

  const PricingCard = ({ title, price, period, description, features, recommended = false, buttonText = "Get Started" }: any) => (
    <div className={`relative p-8 rounded-3xl border flex flex-col h-full ${recommended ? 'border-red-500 shadow-xl ring-4 ring-red-500/10 bg-white' : 'border-gray-200 bg-white shadow-sm hover:border-red-200 transition-colors'}`}>
      {recommended && (
        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
          Best Value
        </div>
      )}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500 mt-2 h-10">{description}</p>
      </div>
      <div className="mb-6">
        <span className="text-4xl font-extrabold text-slate-900">{price}</span>
        {period && <span className="text-slate-500 font-medium"> {period}</span>}
      </div>
      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feat: string, idx: number) => (
          <li key={idx} className="flex items-start">
            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            <span className="text-sm text-slate-600">{feat}</span>
          </li>
        ))}
      </ul>
      <Button
        onClick={onRegister}
        className={`w-full justify-center py-3 ${recommended ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-50 text-slate-900 hover:bg-slate-100 border border-slate-200'}`}
      >
        {buttonText}
      </Button>
    </div>
  );

  // --- SUB-PAGES ---

  const AboutUs = () => (
    <div className="pt-32 pb-20 max-w-4xl mx-auto px-6">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Empowering Logistics in Cambodia</h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          Doorstep is more than just software. We are a technology company dedicated to modernizing how goods move across the kingdom.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
        <div>
          <img src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&q=80&w=1000" alt="Delivery Team" className="rounded-2xl shadow-xl" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">Our Story</h3>
          <p className="text-slate-600 mb-4">
            Founded in Phnom Penh, we noticed that small delivery businesses were struggling with notebooks, lost cash, and constant phone calls.
          </p>
          <p className="text-slate-600">
            We built Doorstep to solve this. By combining real-time tracking with an automated accounting ledger, we help businesses focus on growth rather than paperwork.
          </p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-3xl p-10 border border-slate-200 text-center">
        <h3 className="text-xl font-bold text-slate-900 mb-8">Our Impact</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="text-4xl font-extrabold text-red-600 mb-2">50k+</div>
            <div className="text-sm font-bold text-slate-500 uppercase">Parcels Delivered</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-indigo-600 mb-2">$2M+</div>
            <div className="text-sm font-bold text-slate-500 uppercase">COD Processed</div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-green-600 mb-2">100+</div>
            <div className="text-sm font-bold text-slate-500 uppercase">Happy Partners</div>
          </div>
        </div>
      </div>
    </div>
  );

  const ContactUs = () => (
    <div className="pt-32 pb-20 max-w-6xl mx-auto px-6">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Get in Touch</h1>
        <p className="text-lg text-slate-600">Have questions? We'd love to hear from you.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Contact Information</h3>

            <div className="space-y-6">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-bold text-slate-900">Headquarters</p>
                  <p className="text-slate-600 mt-1">Level 4, Vattanac Capital<br />No. 66 Preah Monivong Blvd, Phnom Penh</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-bold text-slate-900">Email Us</p>
                  <p className="text-slate-600 mt-1">support@doorstep.com.kh</p>
                  <p className="text-slate-600">sales@doorstep.com.kh</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center text-green-600 flex-shrink-0 mt-1">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-bold text-slate-900">Call Us</p>
                  <p className="text-slate-600 mt-1">+855 12 345 678 (KH/EN)</p>
                  <p className="text-slate-600">Mon-Sat, 8am - 6pm</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-gray-50 p-8 rounded-3xl border border-gray-200">
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); toast.success("Message sent! We will contact you shortly."); }}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
              <input type="text" className="w-full rounded-xl border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 py-3" placeholder="John Doe" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input type="email" className="w-full rounded-xl border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 py-3" placeholder="john@example.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
              <textarea rows={4} className="w-full rounded-xl border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 py-3" placeholder="How can we help?" required></textarea>
            </div>
            <Button type="submit" className="w-full justify-center bg-red-600 hover:bg-red-700">Send Message</Button>
          </form>
        </div>
      </div>
    </div>
  );

  const HelpCenter = () => (
    <div className="pt-32 pb-20 max-w-4xl mx-auto px-6">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-6">Help Center</h1>
        <p className="text-lg text-slate-600">Frequently Asked Questions</p>
      </div>

      <div className="space-y-4">
        {[
          { q: "How do I create an account?", a: "Click on 'Start Free' in the top right corner. You can register as a Customer, Driver, or Business Admin." },
          { q: "Is the software free?", a: "We offer a free tier for general users. For business partners with high volume, we offer premium plans with advanced reporting." },
          { q: "How does Cash on Delivery (COD) work?", a: "Drivers collect cash from the receiver. This cash is tracked in the 'Wallet' section. Drivers can then settle this amount with the company via bank transfer." },
          { q: "Can I track my parcel?", a: "Yes! Enter your booking reference number in the 'Track Shipment' tool on the homepage or dashboard." },
          { q: "Do you support KHR currency?", a: "Absolutely. Our system handles both USD ($) and KHR (៛) simultaneously, with real-time exchange rate calculations." }
        ].map((faq, idx) => (
          <div key={idx} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:border-red-100 transition-colors">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{faq.q}</h3>
            <p className="text-slate-600">{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center bg-indigo-50 rounded-2xl p-8">
        <h3 className="text-xl font-bold text-indigo-900 mb-2">Still need help?</h3>
        <p className="text-indigo-700 mb-6">Our support team is available 24/7 to assist you.</p>
        <button onClick={() => setActivePage('CONTACT')} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors">
          Contact Support
        </button>
      </div>
    </div>
  );

  const PrivacyPolicy = () => (
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

        {/* What information do we collect? */}
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

        {/* What do we use your information for? */}
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

        {/* How do we protect your information? */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">How do we protect your information?</h2>
          <p>We implement a variety of security measures to maintain the safety of your personal information when you enter, submit, or access your personal information. We offer the use of a secure server. All supplied sensitive/credit information is transmitted via Secure Socket Layer (SSL) technology and then encrypted into our Payment gateway providers database only to be accessible by those authorized with special access rights to such systems, and are required to keep the information confidential. After a transaction, your private information (credit cards, identification, financials, etc.) will not be stored on our servers.</p>
        </section>

        {/* Do we use cookies? */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Do we use cookies?</h2>
          <p className="mb-4">Yes. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser (if you allow) that enables the sites or service providers systems to recognize your browser and capture and remember certain information.</p>
          <p className="mb-4">We use cookies to understand and save your preferences for future visits, to advertise to you on other sites and compile aggregate data about site traffic and site interaction so that we can offer better site experiences and tools in the future.</p>
          <p>You may refuse to accept cookies by activating the setting on your browser which allows you to refuse the setting of cookies. However, if you choose to disable cookies, you may be unable to access certain parts of our site.</p>
        </section>

        {/* Do we disclose any information to outside parties? */}
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

        {/* Third Party Links */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Third Party Links</h2>
          <p>Occasionally, at our discretion, we may include or offer third party products or services on our website. If you access other websites using the links provided, the operators of these websites may collect information from you that will be used by them in accordance with their privacy policies. These third party sites have separate and independent privacy policies. We therefore have no responsibility or liability for the content and activities of these linked sites.</p>
        </section>

        {/* International Transfers */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">International Transfers</h2>
          <p>If you are visiting our website or using our Services from outside Cambodia, please be aware that you are sending personal information to Cambodia where our servers are located. Cambodia may not have data protection laws that are as comprehensive or protective as those in your country of residence; however, our collection, storage and use of your personal information will at all times be in accordance with this Privacy Policy.</p>
        </section>

        {/* Your Rights */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Your Rights</h2>
          <p className="mb-4">You may have the right to access a copy of the personal information we hold about you, or to request the correction, amendment or deletion of such information where it is inaccurate or processed in violation of the Privacy Shield Principles.</p>
          <p>Furthermore, we commit to giving you an opportunity to opt-out if your personal information is to be disclosed to any other independent third parties, or to be used for a purpose materially different from those that are set out in this Privacy Policy. Where sensitive personal information is involved, we will always obtain your express opt-in consent.</p>
        </section>

        {/* Data Retention */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Data Retention</h2>
          <p className="mb-4">We may retain your personal information as long as you continue to use the Services, have an account with us or for as long as is necessary to fulfil the purposes outlined in the policy. You can ask to close your account by contacting us and we will delete your personal information on request.</p>
          <p>We may however retain personal information for an additional period as is permitted or required under applicable laws, for legal, tax or regulatory reasons, or for legitimate and lawful business purposes.</p>
        </section>

        {/* Changes to our Privacy Policy */}
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
  );

  const TermsOfUse = () => (
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

        {/* Section 1 */}
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

        {/* Section 2 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">2. Account Requirements</h2>
          <div className="space-y-4">
            <p><strong>2.1</strong> In order to use the Services, you must register for and maintain an active DoorStep account ("DoorStep Account") and provide certain information including your email address and any other information identified as being required. You agree to maintain accurate, complete, and up-to-date information for your DoorStep Account.</p>
            <p><strong>2.2</strong> You are responsible for all activity and content, such as photos, images, videos, graphics, written content, audio files, code, information, or data uploaded, collected, generated, stored, displayed, distributed, transmitted or exhibited on or in connection with your DoorStep Account and your use of the Services.</p>
            <p><strong>2.3</strong> You agree to maintain the security and secrecy of your DoorStep Account password(s) at all times. You must promptly notify DoorStep if you become aware of or reasonably suspect any security breach. DoorStep cannot and will not be liable for any loss or damage from your failure to maintain the security of your DoorStep Account and password.</p>
          </div>
        </section>

        {/* Section 3 */}
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

        {/* Section 4 */}
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

        {/* Section 5 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">5. Privacy and User Data</h2>
          <p>You understand that any information you provide to us in using the Services (not including credit card information), may be transferred unencrypted and involve (a) transmissions over various networks; and (b) changes to conform and adapt to technical requirements of connecting networks or devices. Credit card information is always encrypted during transfer over networks. Any personal information you provide will be treated in accordance with our Privacy Policy.</p>
        </section>

        {/* Section 6 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">6. Accuracy, Completeness and Timeliness of Information</h2>
          <div className="space-y-4">
            <p><strong>6.1</strong> We make no warranties with respect to the information made available by the Services, and we are not responsible if that information is not accurate, complete, up-to-date or otherwise does not meet your specific requirements.</p>
            <p><strong>6.2</strong> Occasionally there may be information that contains typographical errors, inaccuracies or omissions. We undertake no obligation to correct, update, amend or clarify such information.</p>
          </div>
        </section>

        {/* Section 7 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">7. Intellectual Property</h2>
          <div className="space-y-4">
            <p><strong>7.1</strong> You grant DoorStep a limited, non-exclusive, sublicensable, royalty-free license to access, use, reproduce, electronically distribute, transmit, perform, format, display, store, archive, and index the Content for the purpose of supporting your use of the Services.</p>
            <p><strong>7.2</strong> You are solely responsible for the Content that you upload, publish, display, link to, or otherwise make available via the Services. DoorStep retains the authority to remove any Content that it deems in violation of these Terms of Service.</p>
          </div>
        </section>

        {/* Section 8 */}
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

        {/* Section 9 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">9. User Comments, Feedback and Other Submissions</h2>
          <p>You agree that your Comments will not violate any right of any third-party, including copyright, trademark, privacy, personality or other rights. You further agree that your Comments will not contain libelous, defamatory or otherwise unlawful, abusive, hateful or obscene material. You are solely responsible for any Comments you make and their accuracy.</p>
        </section>

        {/* Section 10 */}
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

        {/* Section 11 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">11. Disclaimer of Warranties; Limitation of Liability</h2>
          <div className="space-y-4">
            <p><strong>11.1</strong> You expressly agree that your use of, or inability to use, the Services is at your sole risk. The Services is provided "as is" and "as available" for your use, without any representation, warranties or conditions of any kind, either express, implied or statutory.</p>
            <p><strong>11.2</strong> In no event shall DoorStep or its Affiliates be liable for any injury, loss, claim, or any direct, indirect, incidental, punitive, special, or consequential damages of any kind, including lost profits, lost revenue, lost savings, loss of data, replacement costs, or any similar damages.</p>
          </div>
        </section>

        {/* Section 12 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">12. Indemnification</h2>
          <p>You agree to indemnify, defend and hold harmless DoorStep and its Affiliates from any claim or demand, including reasonable attorneys' fees, made by any third-party, due to or arising out of a claim alleging that you, the Content or any Product infringes or violates the intellectual property rights, privacy rights or other rights of a third party or violates applicable law.</p>
        </section>

        {/* Section 13 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">13. Dispute Resolution</h2>
          <div className="space-y-4">
            <p><strong>13.1</strong> Any issues or disputes that arise between you and Buyer in connection with your sale or attempted sale of Products via DoorStep must be reported directly to us through the Services and will be handled in accordance with the Merchant Policy.</p>
            <p><strong>13.2</strong> By agreeing to these Terms of Service, you agree that you are required to resolve any claim that you may have against DoorStep on an individual basis in arbitration. These Terms of Service shall be governed by and interpreted in accordance with the laws of the Kingdom of Cambodia.</p>
          </div>
        </section>

        {/* Section 14 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">14. Termination</h2>
          <div className="space-y-4">
            <p><strong>14.1</strong> These Terms of Service are effective unless and until terminated by either you or us. You may terminate these Terms of Service at any time by deleting the DoorStep application or by closing your DoorStep store.</p>
            <p><strong>14.2</strong> If in our sole judgment you fail to comply with any term or provision of these Terms of Service, we may terminate these Terms of Service at any time without notice.</p>
            <p><strong>14.3</strong> Upon termination: (a) DoorStep will cease providing you with the Services; (b) you will not be entitled to any refunds; and (c) any outstanding balance owed will immediately become due and payable in full.</p>
          </div>
        </section>

        {/* Section 15 */}
        <section className="mb-10">
          <h2 className="text-xl font-bold text-slate-900 mb-4">15. Severability</h2>
          <p>In the event that any provision of these Terms of Service is determined by a court of competent jurisdiction to be unlawful, void or unenforceable, such provision shall nonetheless be enforceable to the fullest extent permitted by applicable law, and such determination shall not affect the validity and enforceability of any other remaining provisions.</p>
        </section>

        {/* Section 16 */}
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
  );

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-red-100 selection:text-red-900">

      {/* --- NAVBAR --- */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActivePage('HOME')}>
              <img src="/logo/DoorStep.png" alt="Doorstep" className="h-7 w-auto object-contain" />
              <span className="text-2xl font-bold tracking-tight text-slate-900">Doorstep</span>
            </div>

            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('features')} className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">How it Works</button>
              <button onClick={() => scrollToSection('solutions')} className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">Benefits</button>
              <button onClick={() => scrollToSection('pricing')} className="text-sm font-medium text-slate-600 hover:text-red-600 transition-colors">Pricing</button>
            </div>

            <div className="flex items-center gap-3">
              <LanguageSwitcher className="hidden sm:flex" />
              <button onClick={onLogin} className="text-sm font-bold text-slate-700 hover:text-red-600 px-4 py-2 transition-colors">
                Log In
              </button>
              <Button onClick={onRegister} className="shadow-lg shadow-red-600/20">
                Start Free
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {activePage === 'ABOUT' && <AboutUs />}
      {activePage === 'CONTACT' && <ContactUs />}
      {activePage === 'HELP' && <HelpCenter />}
      {activePage === 'PRIVACY' && <PrivacyPolicy />}
      {activePage === 'TERMS' && <TermsOfUse />}

      {activePage === 'HOME' && (
        <>
          {/* --- HERO SECTION --- */}
          <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-red-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="text-center max-w-4xl mx-auto mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-100 text-red-700 text-xs font-bold uppercase tracking-wider mb-6 animate-fade-in-up">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                  Made for Cambodia 🇰🇭
                </div>

                <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 leading-[1.2] mb-6 tracking-tight animate-fade-in-up">
                  Manage Your Delivery <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-600">Business & Money</span> in One Place.
                </h1>

                <p className="text-lg text-slate-600 mb-10 leading-relaxed max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                  Stop using notebooks and spreadsheets. Track drivers, packages, and cash (USD & KHR) easily on your phone or computer.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                  <Button onClick={onRegister} className="px-8 py-4 text-lg h-auto shadow-xl shadow-red-600/20 hover:-translate-y-1 transition-transform">
                    Create Free Account
                  </Button>
                  <button onClick={onLogin} className="px-8 py-4 text-lg font-bold text-slate-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all hover:-translate-y-1 shadow-sm">
                    Log In
                  </button>
                </div>

                {/* App Download Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                  <span className="text-sm text-slate-500">Download the app:</span>
                  <div className="flex gap-3">
                    <a
                      href="https://apps.apple.com/app/doorstep"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors shadow-lg hover:-translate-y-0.5 transform transition-transform"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      <div className="text-left">
                        <div className="text-[10px] leading-none opacity-80">Download on the</div>
                        <div className="text-sm font-semibold leading-tight">App Store</div>
                      </div>
                    </a>
                    <a
                      href="https://play.google.com/store/apps/details?id=com.doorstep"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors shadow-lg hover:-translate-y-0.5 transform transition-transform"
                    >
                      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.198l2.807 1.626a1 1 0 010 1.73l-2.808 1.626L15.206 12l2.492-2.491zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" />
                      </svg>
                      <div className="text-left">
                        <div className="text-[10px] leading-none opacity-80">Get it on</div>
                        <div className="text-sm font-semibold leading-tight">Google Play</div>
                      </div>
                    </a>
                  </div>
                </div>

                <div className="mt-12 flex flex-wrap justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                  <FeaturePill
                    icon={<div className="w-2 h-2 rounded-full bg-green-500"></div>}
                    text="Works in Khmer & English"
                  />
                  <FeaturePill
                    icon={<svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                    text="USD ($) and Riel (៛)"
                  />
                  <FeaturePill
                    icon={<svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    text="No Accounting Knowledge Needed"
                  />
                </div>
              </div>

              {/* Simple Process Visualization */}
              <div className="relative rounded-3xl bg-white p-8 shadow-2xl border border-gray-100 max-w-5xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
                <h3 className="text-center text-lg font-bold text-gray-500 mb-8 uppercase tracking-wider">How Delivery Works</h3>

                {/* Desktop Connector Line */}
                <div className="hidden md:block absolute top-[55%] left-20 right-20 h-1 bg-gray-100 -z-0 rounded-full"></div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
                  {/* Step 1 */}
                  <div className="flex flex-col items-center text-center bg-white">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <h4 className="font-bold text-lg text-slate-900">1. Booking</h4>
                    <p className="text-sm text-slate-500 mt-1">Customer books on phone</p>
                  </div>

                  {/* Step 2 */}
                  <div className="flex flex-col items-center text-center bg-white">
                    <div className="w-20 h-20 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-orange-100">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h4 className="font-bold text-lg text-slate-900">2. Pickup</h4>
                    <p className="text-sm text-slate-500 mt-1">Driver collects parcel</p>
                  </div>

                  {/* Step 3 */}
                  <div className="flex flex-col items-center text-center bg-white">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-indigo-100">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    </div>
                    <h4 className="font-bold text-lg text-slate-900">3. Drop-off</h4>
                    <p className="text-sm text-slate-500 mt-1">Delivered to receiver</p>
                  </div>

                  {/* Step 4 */}
                  <div className="flex flex-col items-center text-center bg-white">
                    <div className="w-20 h-20 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-green-100">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <h4 className="font-bold text-lg text-slate-900">4. Get Paid</h4>
                    <p className="text-sm text-slate-500 mt-1">Money recorded safely</p>
                  </div>
                </div>

                {/* Floating Widget 1 */}
                <div className="absolute -bottom-6 -right-6 md:bottom-10 md:right-10 bg-white p-4 rounded-xl shadow-2xl border border-gray-100 flex items-center gap-4 animate-bounce hidden md:flex" style={{ animationDuration: '4s' }}>
                  <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">Cash Collected</p>
                    <p className="text-lg font-bold text-slate-900">$450.00</p>
                    <p className="text-xs text-green-600">Safe & Recorded</p>
                  </div>
                </div>

                {/* Floating Widget 2 */}
                <div className="absolute top-4 -left-4 md:top-12 md:-left-12 bg-white p-4 rounded-xl shadow-2xl border border-gray-100 animate-bounce hidden md:block" style={{ animationDuration: '5s' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold uppercase">New Customers</p>
                      <p className="text-lg font-bold text-slate-900 flex items-center">
                        +128
                        <span className="ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Last 7 Days</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex -space-x-2 overflow-hidden">
                    {[1, 2, 3].map((_, i) => (
                      <div key={i} className={`inline-block h-8 w-8 rounded-full ring-2 ring-white flex items-center justify-center ${i === 0 ? 'bg-blue-100' : i === 1 ? 'bg-indigo-100' : 'bg-green-100'}`}>
                        <svg className={`w-5 h-5 ${i === 0 ? 'text-blue-500' : i === 1 ? 'text-indigo-500' : 'text-green-500'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      </div>
                    ))}
                    <div className="h-8 w-8 rounded-full ring-2 ring-white bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">+125</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* --- DEEP DIVE: FEATURES --- */}
          <section id="features" className="py-24 bg-white overflow-hidden scroll-mt-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

              {/* Feature 1 */}
              <div className="flex flex-col lg:flex-row items-center gap-16 mb-24">
                <div className="lg:w-1/2 order-2 lg:order-1">
                  <div className="relative rounded-2xl bg-slate-900 p-2 shadow-2xl ring-1 ring-gray-900/10">
                    <div className="absolute -top-4 -left-4 bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg z-10">Assign Drivers</div>
                    <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=2400" className="rounded-lg opacity-80" alt="Map" />
                    {/* Mock UI Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-white/95 backdrop-blur rounded-xl p-4 shadow-xl max-w-sm w-full mx-4">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                          <span className="font-bold text-slate-800">Booking #8921</span>
                          <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-1 rounded">New</span>
                        </div>
                        <div className="space-y-2">
                          <div className="h-2 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-2 bg-gray-200 rounded w-1/2"></div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button className="flex-1 bg-indigo-600 text-white text-xs py-2 rounded font-medium">Assign Driver</button>
                          <button className="flex-1 border border-gray-300 text-gray-600 text-xs py-2 rounded font-medium">Reject</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="lg:w-1/2 order-1 lg:order-2">
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">Easy Driver Assignment</h2>
                  <p className="text-lg text-slate-600 mb-6">
                    See new bookings on your screen. Click one button to give the job to a driver. They see it on their phone instantly.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mt-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-slate-700">See which driver is free</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mt-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-slate-700">Scan barcodes at the warehouse</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mt-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-slate-700">Update status for many items at once</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="flex flex-col lg:flex-row items-center gap-16">
                <div className="lg:w-1/2">
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">No More Notebooks</h2>
                  <p className="text-lg text-slate-600 mb-6">
                    When a driver finishes a job, the money is recorded automatically. You always know who owes what.
                  </p>
                  <ul className="space-y-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mt-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-slate-700">See Profit instantly</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mt-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-slate-700">Calculate Driver Pay automatically</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mt-1 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-slate-700">Track company assets like Motos and Tuktuks</span>
                    </li>
                  </ul>
                </div>
                <div className="lg:w-1/2">
                  <div className="relative rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                      <h4 className="font-bold text-slate-900">Money Record</h4>
                      <span className="text-xs text-slate-500 bg-gray-100 px-2 py-1 rounded">Auto-Saved</span>
                    </div>
                    <div className="space-y-3 font-mono text-xs md:text-sm">
                      <div className="flex justify-between p-2 bg-green-50 rounded text-green-800">
                        <span>Money In (Cash)</span>
                        <span>$50.00</span>
                      </div>
                      <div className="flex justify-between p-2 bg-red-50 rounded text-red-800">
                        <span>Owe to Customer</span>
                        <span>$45.00</span>
                      </div>
                      <div className="flex justify-between p-2 bg-blue-50 rounded text-blue-800">
                        <span>Delivery Profit</span>
                        <span>$5.00</span>
                      </div>
                    </div>
                    <div className="mt-6 text-center">
                      <p className="text-slate-500 text-sm italic">"Money recorded automatically when job is done"</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* --- THE PROBLEM / BENEFITS --- */}
          <section id="solutions" className="py-24 bg-slate-50 scroll-mt-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Why use Doorstep?</h2>
                <p className="text-slate-600 max-w-2xl mx-auto">Running a delivery business is hard. We make it simple so you stop losing money and packages.</p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-6 text-red-600">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Stop Writing by Hand</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    When a driver delivers a package, the system updates automatically. No more messy notebooks or lost papers.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-6 text-indigo-600">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Don't Lose Cash (COD)</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Know exactly how much cash each driver is holding. Track USD and KHR separately so the numbers always match.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                  <div className="w-14 h-14 bg-teal-100 rounded-2xl flex items-center justify-center mb-6 text-teal-600">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Easy for Customers</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Customers can book deliveries on their phone. They don't need to call you or message you every time.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* --- PRICING SECTION --- */}
          <section id="pricing" className="py-24 bg-slate-50 scroll-mt-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-16">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Affordable & Flexible</h2>
                <p className="text-slate-600 max-w-2xl mx-auto">
                  Start small and save big as you grow. We offer simple per-parcel pricing.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {/* Standard Tier */}
                <PricingCard
                  title="General User"
                  price="5,000៛"
                  period="or $1.25 / parcel"
                  description="Simple per-delivery price. Pay as you go."
                  features={[
                    "Phnom Penh Delivery",
                    "Cash on Delivery (COD)",
                    "Real-time Tracking",
                    "Fast Pickup"
                  ]}
                  buttonText="Send Now"
                />

                {/* Partner Tier */}
                <PricingCard
                  title="Business Partner"
                  price="Locked Rate"
                  period="(Cheaper)"
                  description="For shops with regular deliveries."
                  recommended={true}
                  features={[
                    "Cheaper than standard rate",
                    "Lock price by monthly volume",
                    "Priority Pickup",
                    "Daily Settlement",
                    "Dedicated Support"
                  ]}
                  buttonText="Become a Partner"
                />

                {/* Corporate Tier */}
                <PricingCard
                  title="Corporate / Franchise"
                  price="Custom"
                  period=""
                  description="Manage your own fleet using our system."
                  features={[
                    "Use Doorstep System",
                    "Manage your own drivers",
                    "Custom Branding",
                    "API Integration"
                  ]}
                  buttonText="Contact Sales"
                />
              </div>
            </div>
          </section>

          {/* --- CTA SECTION --- */}
          <section className="py-24 bg-slate-900 text-white text-center">
            <div className="max-w-4xl mx-auto px-4">
              <h2 className="text-4xl font-bold mb-6">Ready to grow your business?</h2>
              <p className="text-lg text-slate-300 mb-10">
                Join the easy platform that handles the hard work for you.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button onClick={onRegister} className="px-10 py-4 text-lg bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/50 border-none">
                  Create Free Account
                </Button>
                <button onClick={onLogin} className="px-10 py-4 text-lg font-bold border border-slate-600 rounded-xl hover:bg-slate-800 transition-colors">
                  Log In
                </button>
              </div>
              <p className="mt-6 text-sm text-slate-500">No credit card needed.</p>
            </div>
          </section>
        </>
      )}

      {/* --- FOOTER --- */}
      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo/DoorStep.png" alt="Doorstep" className="h-6 w-auto object-contain" />
                <span className="text-xl font-bold text-slate-900">Doorstep</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                The easy operating system for modern logistics companies in Cambodia.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-red-600">Dispatcher</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-red-600">Driver App</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-red-600">Accounting</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={() => setActivePage('ABOUT')} className="hover:text-red-600">About Us</button></li>
                <li><button onClick={() => setActivePage('CONTACT')} className="hover:text-red-600">Contact</button></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><button onClick={() => setActivePage('HELP')} className="hover:text-red-600">Help Center</button></li>
                <li><button onClick={() => setActivePage('PRIVACY')} className="hover:text-red-600">Privacy Policy</button></li>
                <li><button onClick={() => setActivePage('TERMS')} className="hover:text-red-600">Terms of Use</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 mt-12 pt-8 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Doorstep Logistics Technology. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
