import React from 'react';
import HowItWorks from './HowItWorks';

export default function AboutView({ onBackToHome }) {
  return (
    <div className="about-view-container">
      <div className="about-hero-box">
        <h1 className="about-title">About RoadGuard</h1>
        <p className="about-lead">
          Navigation apps pick the fastest road. They do not know that the road has a broken patch or an
          unmarked hump that will scrape a low car. RoadGuard looks at the actual road surface, through
          Google Street View, and rates each route for the vehicle you drive.
        </p>
        <button type="button" className="btn-action-primary" onClick={onBackToHome}>Analyse a route</button>
        <p className="about-contact">Questions or feedback: <a href="mailto:projectk89dsda@gmail.com">projectk89dsda@gmail.com</a></p>
      </div>

      <div className="about-content-grid">
        <div className="about-feature-card">
          <h3>What it detects</h3>
          <p>Potholes and speed breakers, using two YOLOv8 models fine-tuned on Indian road images. Each detection comes with its confidence and the frame it was seen in, so you can judge it yourself.</p>
        </div>
        <div className="about-feature-card">
          <h3>Why ground clearance</h3>
          <p>The same hump is harmless to an SUV at 200 mm and a problem for a sedan at 145 mm. Risk is scaled by the clearance of your vehicle, from lowered coupes up to off-roaders.</p>
        </div>
        <div className="about-feature-card">
          <h3>Limits</h3>
          <p>Street View imagery can be years old and is missing on many small roads. Detections are automated and sometimes wrong. Treat the result as a heads-up, not a guarantee.</p>
        </div>
      </div>

      <HowItWorks />
    </div>
  );
}
