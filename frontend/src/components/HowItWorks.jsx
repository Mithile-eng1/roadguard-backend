import React from 'react';

const STEPS = [
  ['Routes', 'Google Directions returns the driving route and its alternatives between your two points.'],
  ['Street View', 'Every panorama along each route (about one every 10 m) is fetched as a forward-facing frame.'],
  ['Detection', 'A YOLOv8 model trained on Indian road images marks potholes and speed breakers in each frame. Repeat sightings across consecutive frames are merged.'],
  ['Scoring', 'Each hazard is weighted by confidence and by the ground clearance of your vehicle; the route with the lowest total risk is recommended.'],
];

export default function HowItWorks() {
  return (
    <section className="how-it-works-section" id="about-pipeline">
      <h3 className="section-title">How a route is analysed</h3>
      <ol className="how-steps">
        {STEPS.map(([title, desc], i) => (
          <li key={title}>
            <span className="how-step-num">{i + 1}</span>
            <div>
              <div className="how-step-title">{title}</div>
              <p className="how-step-desc">{desc}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
