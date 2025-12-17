
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { LanguageSwitcher } from './ui/LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';
import { toast } from '../src/shared/utils/toast';

type PageType = 'HOME' | 'ABOUT' | 'CONTACT' | 'HELP' | 'PRIVACY';

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
    <div className="pt-32 pb-20 max-w-3xl mx-auto px-6">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Privacy Policy</h1>
      <p className="text-slate-500 mb-10">Last updated: {new Date().toLocaleDateString()}</p>

      <div className="prose prose-slate max-w-none">
        <h3 className="text-xl font-bold text-slate-900 mb-4">1. Information We Collect</h3>
        <p className="text-slate-600 mb-6">
          We collect information you provide directly to us, such as when you create an account, request a delivery, or contact customer support. This includes:
          <br />
          - Name and Contact Information
          <br />
          - Delivery Addresses and Location Data
          <br />
          - Payment and Transaction Information
        </p>

        <h3 className="text-xl font-bold text-slate-900 mb-4">2. How We Use Your Information</h3>
        <p className="text-slate-600 mb-6">
          We use the information we collect to provide, maintain, and improve our services, such as:
          <br />
          - Processing and completing deliveries
          <br />
          - Calculating fees and processing payments
          <br />
          - Sending you technical notices and support messages
        </p>

        <h3 className="text-xl font-bold text-slate-900 mb-4">3. Data Security</h3>
        <p className="text-slate-600 mb-6">
          We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.
          We use secure cloud infrastructure and encryption for sensitive data.
        </p>

        <h3 className="text-xl font-bold text-slate-900 mb-4">4. Contact Us</h3>
        <p className="text-slate-600 mb-6">
          If you have any questions about this Privacy Policy, please contact us at privacy@doorstep.com.kh.
        </p>
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
              <div className="h-10 w-10 bg-red-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-red-600/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
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

      {/* --- CONTENT SWITCHER --- */}
      {activePage === 'ABOUT' && <AboutUs />}
      {activePage === 'CONTACT' && <ContactUs />}
      {activePage === 'HELP' && <HelpCenter />}
      {activePage === 'PRIVACY' && <PrivacyPolicy />}

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

                <div className="mt-12 flex flex-wrap justify-center gap-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}>
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
                <div className="h-8 w-8 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold">D</div>
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
