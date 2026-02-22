import React from 'react';
import { Input } from '../ui/Input';
import { EmailSettings } from '../../src/shared/types';

interface Props {
    settings: EmailSettings;
    onChange: (settings: EmailSettings) => void;
}

export const EmailSettingsEditor: React.FC<Props> = ({ settings, onChange }) => {
    const handleChange = (field: keyof EmailSettings, value: any) => {
        onChange({ ...settings, [field]: value });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-medium text-gray-900">Email Configuration</h3>
                    <p className="text-sm text-gray-500">Configure how the system sends emails (SMTP, etc.)</p>
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="email-enabled"
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        checked={settings.enabled}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('enabled', e.target.checked)}
                    />
                    <label htmlFor="email-enabled" className="ml-2 block text-sm text-gray-900 font-medium">
                        Enable Email Notifications
                    </label>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
                    <select
                        value={settings.provider}
                        onChange={(e) => handleChange('provider', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                        <option value="smtp">SMTP Server</option>
                        <option value="gmail">Gmail (App Password)</option>
                        <option value="sendgrid">SendGrid</option>
                        <option value="none">Disable Email</option>
                    </select>
                </div>

                {settings.provider === 'smtp' && (
                    <>
                        <Input
                            label="SMTP Host"
                            value={settings.smtpHost || ''}
                            onChange={(e) => handleChange('smtpHost', e.target.value)}
                            placeholder="e.g. smtp.gmail.com"
                        />
                        <Input
                            label="SMTP Port"
                            type="number"
                            value={settings.smtpPort?.toString() || ''}
                            onChange={(e) => handleChange('smtpPort', parseInt(e.target.value) || 0)}
                            placeholder="e.g. 587"
                        />
                        <Input
                            label="SMTP Username"
                            value={settings.smtpUser || ''}
                            onChange={(e) => handleChange('smtpUser', e.target.value)}
                        />
                        <Input
                            label="SMTP Password"
                            type="password"
                            value={settings.smtpPass || ''}
                            onChange={(e) => handleChange('smtpPass', e.target.value)}
                        />
                    </>
                )}

                {settings.provider !== 'none' && (
                    <>
                        <Input
                            label="From Email Address"
                            value={settings.fromEmail || ''}
                            onChange={(e) => handleChange('fromEmail', e.target.value)}
                            placeholder="sender@example.com"
                        />
                        <Input
                            label="From Name"
                            value={settings.fromName || ''}
                            onChange={(e) => handleChange('fromName', e.target.value)}
                            placeholder="Doorstep Notifications"
                        />
                    </>
                )}
            </div>
        </div>
    );
};
