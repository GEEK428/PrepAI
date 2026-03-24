import React from 'react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'

const Loader = ({ message = "Loading...", style = {} }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', minHeight: '300px', ...style }}>
            <div style={{ width: '250px', height: '250px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <DotLottieReact
                    src="https://lottie.host/9a5800e1-2d0f-4bee-9671-b1caa224e728/GpXHEoxq8o.lottie"
                    loop
                    autoplay
                />
            </div>
            {message && <p style={{ marginTop: '1rem', color: '#9fd0f4', fontSize: '1rem', fontWeight: '500', letterSpacing: '0.05em' }}>{message}</p>}
        </div>
    )
}

export default Loader
