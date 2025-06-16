import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { Annotation } from '@/types';

// Define the directory where annotations will be stored
const annotationsDir = path.resolve(process.cwd(), 'annotations');

// Function to create a safe filename from the annotator's name
const sanitizeFilename = (name: string) => {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    try {
      const annotation: Annotation = req.body;
      
      if (!annotation.annotatorName) {
        return res.status(400).json({ message: 'Annotator name is required.' });
      }

      // Ensure the annotations directory exists
      await fs.mkdir(annotationsDir, { recursive: true });

      // Create a unique filename for the annotator
      const safeName = sanitizeFilename(annotation.annotatorName);
      const annotationsFilePath = path.join(annotationsDir, `annotations-${safeName}.jsonl`);

      const annotationWithTimestamp = {
        ...annotation,
        timestamp: new Date().toISOString(),
      };

      const annotationLine = JSON.stringify(annotationWithTimestamp) + '\n';

      // Append the new annotation to the user-specific file
      await fs.appendFile(annotationsFilePath, annotationLine);

      res.status(200).json({ message: 'Annotation saved successfully.' });
    } catch (error) {
      console.error('Error saving annotation:', error);
      res.status(500).json({ message: 'Failed to save annotation.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 