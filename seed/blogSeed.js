const mongoose = require('mongoose');
const dotenv = require('dotenv');
const BlogPost = require('../models/BlogPost');

dotenv.config();

// const posts = [
//   {
//     title: 'How to Remove Background from Image Online: 2026 Guide',
//     slug: 'how-to-remove-background',
//     description: 'A comprehensive, step-by-step guide to removing image backgrounds online using AI. Perfect for e-commerce, design, and social media.',
//     content: `
//       <p>Removing the background from an image used to be a tedious task reserved for Photoshop experts. Today, thanks to advancements in Artificial Intelligence, you can <strong>remove the background from an image online</strong> in a matter of seconds.</p>

//       <h2>Why You Need Transparent Images</h2>
//       <p>Whether you are building a Shopify store, designing a YouTube thumbnail, or preparing a presentation, a transparent PNG gives you the ultimate flexibility. It allows you to place your product or portrait onto any color, graphic, or video background seamlessly.</p>

//       <h3>The Evolution of Background Removal</h3>
//       <p>Historically, designers relied on the Magic Wand or Pen Tool. This manual process involved zooming in and tracing the edges of a subject pixel by pixel. In 2026, AI networks trained on billions of images handle semantic segmentation instantly.</p>

//       <h2>Step-by-Step Guide</h2>
//       <ol>
//         <li><strong>Choose the Right Tool:</strong> Use a dedicated AI tool like BGRemover Pro for the best edge detection.</li>
//         <li><strong>Upload Your Image:</strong> Drag and drop your JPG or PNG. High-contrast images work best.</li>
//         <li><strong>Let AI Process:</strong> The neural network analyzes the foreground and background automatically.</li>
//         <li><strong>Download as PNG:</strong> Always save as a PNG to preserve the alpha (transparency) channel! JPEGs do not support transparency.</li>
//       </ol>

//       <h2>Pro Tips for Perfect Cutouts</h2>
//       <ul>
//         <li><strong>Lighting is Key:</strong> Avoid harsh shadows on the wall behind your subject.</li>
//         <li><strong>Focus:</strong> Ensure the subject is sharp. Soft, blurry edges are harder for the AI to define.</li>
//         <li><strong>Contrast:</strong> Wearing a white shirt against a white wall? It might confuse older tools, though modern AI handles context much better.</li>
//       </ul>

//       <p>Ready to try it yourself? Head over to our <a href="/tool">free background remover tool</a> and process your first image in seconds.</p>
//     `,
//     author: 'Alex Carter',
//     readTime: '4 min read',
//     tags: ['Tutorial', 'E-commerce', 'Design'],
//     featuredImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&fit=crop'
//   },
//   {
//     title: 'Top AI Tools for Image Editing in 2026',
//     slug: 'top-ai-tools-image-editing-2026',
//     description: 'Discover the top artificial intelligence tools revolutionizing the graphic design and photography industry this year.',
//     content: `
//       <p>The landscape of image editing has fundamentally shifted. Manual editing is out; AI-assisted workflows are in. Here are the top AI tools you need in your creative stack for 2026.</p>

//       <h2>1. AI Background Removers</h2>
//       <p>Tools like <strong>BGRemover Pro</strong> have eliminated the need for manual clipping paths. By utilizing deep learning, these tools isolate subjects with pixel-perfect accuracy—even around hair and fur—in under 3 seconds.</p>

//       <h2>2. Generative Fill & Expand</h2>
//       <p>Need a photo to be wider? Generative AI can imagine and paint the missing pixels around the borders of your image, flawlessly blending with the original lighting and texture.</p>

//       <h2>3. AI Upscaling</h2>
//       <p>Got a blurry or low-resolution photo? AI upscalers use neural networks to predict and insert missing details, turning a grainy 500px image into a crisp 4K masterpiece.</p>

//       <h3>Integrating AI into Your Workflow</h3>
//       <p>The secret to 2026 design isn't using one tool for everything, but chaining AI tools together. For example:</p>
//       <ul>
//         <li>Use an AI generator to create a base image.</li>
//         <li>Use an AI Upscaler to increase the resolution.</li>
//         <li>Use <strong>BGRemover Pro</strong> to isolate the subject from that generated image.</li>
//         <li>Drop the isolated subject into Canva or Figma for final typography.</li>
//       </ul>

//       <p>Stay ahead of the curve by embracing these tools today.</p>
//     `,
//     author: 'Priya Sharma',
//     readTime: '6 min read',
//     tags: ['AI News', 'Roundup', 'Photography'],
//     featuredImage: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?q=80&w=1000&fit=crop'
//   },
//   {
//     title: 'How to Create Transparent PNG Images',
//     slug: 'how-to-create-transparent-png',
//     description: 'Learn everything you need to know about the PNG format, alpha channels, and how to create images with transparent backgrounds.',
//     content: `
//       <p>If you've ever tried to place a logo onto a colored website background only to see an ugly white box around it, you've encountered the limitations of the JPEG format. The solution? <strong>Transparent PNGs</strong>.</p>

//       <h2>What is a PNG?</h2>
//       <p>PNG stands for Portable Network Graphics. Unlike JPEGs, PNGs support an <strong>Alpha Channel</strong>. While RGB channels control red, green, and blue colors, the alpha channel controls opacity (how transparent a pixel is).</p>

//       <h2>How to Create Them</h2>
//       <h3>Method 1: The Manual Way (Photoshop)</h3>
//       <p>In Photoshop, you would unlock your background layer, use the Magic Wand or Pen Tool to select the background, hit delete to reveal the checkerboard pattern (transparency), and then go to <em>File > Export > Quick Export as PNG</em>.</p>

//       <h3>Method 2: The Fast Way (AI Tools)</h3>
//       <p>Don't have Photoshop? You can use an online tool to do this instantly:</p>
//       <ol>
//         <li>Go to <a href="/free-background-remover">BGRemover Pro</a>.</li>
//         <li>Upload your JPEG image.</li>
//         <li>The AI automatically converts it to a transparent PNG.</li>
//         <li>Download and use immediately.</li>
//       </ol>

//       <h2>Where to Use Transparent PNGs</h2>
//       <p>Transparent images are critical for modern design:</p>
//       <ul>
//         <li><strong>Web Design:</strong> Overlapping images and text creates depth and modern UI aesthetics.</li>
//         <li><strong>Merchandise:</strong> If you are printing a t-shirt via Print-on-Demand, you must upload a transparent PNG, otherwise a giant colored box will print on the shirt!</li>
//         <li><strong>Video Editing:</strong> Drop transparent PNGs onto your Premiere Pro or Final Cut timeline for instant lower-thirds and pop-up graphics.</li>
//       </ul>
//     `,
//     author: 'Jordan Lee',
//     readTime: '5 min read',
//     tags: ['Design Basics', 'Tutorial', 'Format Guide'],
//     featuredImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&fit=crop'
//   }
// ];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected');

    await BlogPost.deleteMany({});
    console.log('Cleared existing blog posts');

    await BlogPost.insertMany(posts);
    console.log('Inserted seed blog posts successfully');

    process.exit(0);
  } catch (err) {
    console.error('Error seeding DB:', err);
    process.exit(1);
  }
};

seedDB();
