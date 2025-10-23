import {
  getImageInfo,
  resizeImage,
  rotateImage,
  adjustBrightness,
  createThumbnail,
  blurImage
} from './dist/commands/index.js';

const inputPath = './src/input.png';

async function testCommands() {
  console.log('Testing ImageMagick MCP commands...\n');

  try {
    // Test 1: Get image info
    console.log('1. Testing getImageInfo...');
    const info = await getImageInfo(inputPath);
    console.log('Result:', info);
    console.log('✅ getImageInfo passed\n');

    // Test 2: Resize image
    console.log('2. Testing resizeImage...');
    const resized = await resizeImage(inputPath, './test-output/resized.png', 400, 600);
    console.log('Result:', resized);
    console.log('✅ resizeImage passed\n');

    // Test 3: Rotate image
    console.log('3. Testing rotateImage...');
    const rotated = await rotateImage(inputPath, './test-output/rotated.png', 45);
    console.log('Result:', rotated);
    console.log('✅ rotateImage passed\n');

    // Test 4: Adjust brightness
    console.log('4. Testing adjustBrightness...');
    const brightened = await adjustBrightness(inputPath, './test-output/brightened.png', 30);
    console.log('Result:', brightened);
    console.log('✅ adjustBrightness passed\n');

    // Test 5: Create thumbnail
    console.log('5. Testing createThumbnail...');
    const thumbnail = await createThumbnail(inputPath, './test-output/thumbnail.png', 100, 100);
    console.log('Result:', thumbnail);
    console.log('✅ createThumbnail passed\n');

    // Test 6: Blur image
    console.log('6. Testing blurImage...');
    const blurred = await blurImage(inputPath, './test-output/blurred.png', 2, 2);
    console.log('Result:', blurred);
    console.log('✅ blurImage passed\n');

    console.log('🎉 All tests passed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testCommands();
