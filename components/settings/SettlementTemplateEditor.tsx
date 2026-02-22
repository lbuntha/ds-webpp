import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { SettlementMessageTemplate } from '../../src/shared/types';

interface Props {
    template: SettlementMessageTemplate;
    onChange: (template: SettlementMessageTemplate) => void;
}

export const SettlementTemplateEditor: React.FC<Props> = ({ template, onChange }) => {
    // Local state for managing which channel's content is currently being viewed/edited
    const [approvedChannelView, setApprovedChannelView] = useState<'telegram' | 'email'>('telegram');
    const [initiatedChannelView, setInitiatedChannelView] = useState<'telegram' | 'email'>('telegram');

    const handleChange = <T extends keyof SettlementMessageTemplate>(field: T, value: SettlementMessageTemplate[T]) => {
        onChange({ ...template, [field]: value });
    };

    const placeholders = [
        { key: '{{customerName}}', desc: 'Full name of the customer' },
        { key: '{{txnId}}', desc: 'Transaction Reference ID' },
        { key: '{{parcelCount}}', desc: 'Number of parcels in settlement' },
        { key: '{{totalCod}}', desc: 'Total COD amount' },
        { key: '{{totalFeesUsd}}', desc: 'Total delivery fees in USD' },
        { key: '{{totalFeesKhr}}', desc: 'Total delivery fees in KHR' },
        { key: '{{netPayout}}', desc: 'Final amount paid to customer' },
        { key: '{{adminNote}}', desc: 'Note added by admin during approval' },
    ];

    return (
        <div className="space-y-8">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-6">
                <h4 className="text-sm font-bold text-blue-900 mb-2">Instructions & Available Placeholders</h4>
                <p className="text-xs text-blue-700 mb-3">
                    Use placeholders below to dynamically insert data into your messages.
                    Telegram supports *bold* and _italic_ markdown. Email templates support plain text or basic HTML.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-white/50 p-3 rounded-lg">
                    {placeholders.map(p => (
                        <div key={p.key} className="flex flex-col">
                            <code className="text-[11px] font-bold text-blue-600 bg-blue-50 w-fit px-1 rounded">{p.key}</code>
                            <span className="text-[10px] text-gray-500">{p.desc}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-10">
                {/* Approved Template */}
                <div className="space-y-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h3 className="text-sm font-bold text-gray-900">Approved Payout Template</h3>
                        <div className="flex space-x-4">
                            <label className="flex items-center text-xs font-semibold text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mr-1 h-3 w-3"
                                    checked={template.approvedSendTelegram || false}
                                    onChange={(e) => handleChange('approvedSendTelegram', e.target.checked)}
                                />
                                Telegram
                            </label>
                            <label className="flex items-center text-xs font-semibold text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mr-1 h-3 w-3"
                                    checked={template.approvedSendEmail || false}
                                    onChange={(e) => handleChange('approvedSendEmail', e.target.checked)}
                                />
                                Email
                            </label>
                        </div>
                    </div>

                    {/* View Switcher for Approved */}
                    <div className="flex bg-gray-200/50 p-0.5 rounded-lg w-fit">
                        <button
                            onClick={() => setApprovedChannelView('telegram')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${approvedChannelView === 'telegram' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Telegram View
                        </button>
                        <button
                            onClick={() => setApprovedChannelView('email')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${approvedChannelView === 'email' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Email View
                        </button>
                    </div>

                    {approvedChannelView === 'telegram' && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Title (Top Line)</label>
                                <input
                                    type="text"
                                    value={template.approvedTitle}
                                    onChange={(e) => handleChange('approvedTitle', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. *Settlement Payout Approved & Sent*"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Body Text</label>
                                <textarea
                                    value={template.approvedBody}
                                    onChange={(e) => handleChange('approvedBody', e.target.value)}
                                    rows={5}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                    placeholder="Dear {{customerName}}, your payout of {{netPayout}}..."
                                />
                            </div>
                        </div>
                    )}

                    {approvedChannelView === 'email' && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Email Subject</label>
                                <input
                                    type="text"
                                    value={template.emailSubjectApproved || ''}
                                    onChange={(e) => handleChange('emailSubjectApproved', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. Settlement Payout Approved & Sent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Email HTML Body</label>
                                <textarea
                                    value={template.emailBodyApproved || ''}
                                    onChange={(e) => handleChange('emailBodyApproved', e.target.value)}
                                    rows={8}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                    placeholder="Dear {{customerName}}, your payout of {{netPayout}} has been approved and sent..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Initiated Template */}
                <div className="space-y-4 p-4 border border-gray-200 rounded-xl bg-gray-50">
                    <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex flex-col">
                            <h3 className="text-sm font-bold text-gray-900">Initiated Settlement Template</h3>
                            <p className="text-[10px] text-gray-500 italic">Sent when a settlement is requested.</p>
                        </div>
                        <div className="flex space-x-4">
                            <label className="flex items-center text-xs font-semibold text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mr-1 h-3 w-3"
                                    checked={template.initiatedSendTelegram || false}
                                    onChange={(e) => handleChange('initiatedSendTelegram', e.target.checked)}
                                />
                                Telegram
                            </label>
                            <label className="flex items-center text-xs font-semibold text-gray-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mr-1 h-3 w-3"
                                    checked={template.initiatedSendEmail || false}
                                    onChange={(e) => handleChange('initiatedSendEmail', e.target.checked)}
                                />
                                Email
                            </label>
                        </div>
                    </div>

                    {/* View Switcher for Initiated */}
                    <div className="flex bg-gray-200/50 p-0.5 rounded-lg w-fit">
                        <button
                            onClick={() => setInitiatedChannelView('telegram')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${initiatedChannelView === 'telegram' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Telegram View
                        </button>
                        <button
                            onClick={() => setInitiatedChannelView('email')}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${initiatedChannelView === 'email' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Email View
                        </button>
                    </div>

                    {initiatedChannelView === 'telegram' && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Title (Top Line)</label>
                                <input
                                    type="text"
                                    value={template.initiatedTitle}
                                    onChange={(e) => handleChange('initiatedTitle', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. *Settlement process initiated*"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Body Text</label>
                                <textarea
                                    value={template.initiatedBody}
                                    onChange={(e) => handleChange('initiatedBody', e.target.value)}
                                    rows={5}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                    placeholder="Dear {{customerName}}, your payout request of {{netPayout}} has been received..."
                                />
                            </div>
                        </div>
                    )}

                    {initiatedChannelView === 'email' && (
                        <div className="space-y-4 pt-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Email Subject</label>
                                <input
                                    type="text"
                                    value={template.emailSubjectInitiated || ''}
                                    onChange={(e) => handleChange('emailSubjectInitiated', e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    placeholder="e.g. Settlement process initiated"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Email HTML Body</label>
                                <textarea
                                    value={template.emailBodyInitiated || ''}
                                    onChange={(e) => handleChange('emailBodyInitiated', e.target.value)}
                                    rows={8}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                    placeholder="Dear {{customerName}}, your payout request of {{netPayout}} is being processed..."
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border border-gray-200 rounded-xl bg-gray-50 mt-4">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Common Footer (Appears on both statuses)</label>
                    <input
                        type="text"
                        value={template.footer}
                        onChange={(e) => handleChange('footer', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="e.g. Please contact support @doorstep_support for help."
                    />
                </div>
            </div>
        </div>
    );
};
