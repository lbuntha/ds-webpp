import React, { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';

/**
 * Customer Tracking View - Track shipments by tracking code
 * TODO: Implement full tracking with map integration
 */
export default function CustomerTrackingView() {
    const [trackingCode, setTrackingCode] = useState('');

    const handleTrack = () => {
        // TODO: Implement tracking logic
        console.log('Tracking:', trackingCode);
    };

    return (
        <div className="space-y-6">
            <Card title="Track Your Shipment">
                <div className="max-w-2xl mx-auto py-8">
                    <div className="text-center mb-8">
                        <div className="text-6xl mb-4">📦</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Track Your Parcel
                        </h3>
                        <p className="text-gray-600">
                            Enter your tracking code to see the current status and location
                        </p>
                    </div>

                    <div className="space-y-4">
                        <Input
                            label="Tracking Code"
                            value={trackingCode}
                            onChange={(e) => setTrackingCode(e.target.value)}
                            placeholder="Enter tracking code..."
                        />
                        <Button onClick={handleTrack} className="w-full">
                            Track Shipment
                        </Button>
                    </div>

                    <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                            <strong>Coming Soon:</strong> Real-time tracking with map view,
                            delivery status updates, and estimated delivery time.
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
