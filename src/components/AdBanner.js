// client/src/components/AdBanner.js
import React, { useEffect } from 'react';

export default function AdBanner() {
    useEffect(() => {
        // Load Google ads
        try {
            if (window.adsbygoogle) {
                window.adsbygoogle.push({});
            }
        } catch (e) {
            console.log('Ads not loaded yet');
        }
    }, []);

    return (
        <div style={{ 
            padding: '10px', 
            margin: '10px 0',
            backgroundColor: '#1a1f2e',
            borderRadius: '8px'
        }}>
            <ins
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client="ca-pub-4430547471819164"
                data-ad-slot="pub-4430547471819164/2383942529"
                data-ad-format="auto"
                data-full-width-responsive="true"
            ></ins>
        </div>
    );
}