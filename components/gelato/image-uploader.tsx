import React, { useState, useCallback } from "react";
import { Upload, X, Image as ImageIcon, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
  name: string;
  size: string;
}

interface ImageUploaderProps {
  onImagesChange: (images: ImageFile[]) => void;
  processingOptions: {
    upscale: boolean;
    fitMode: "stretch" | "preserve" | "exact";
  };
  onOptionsChange: (options: { upscale: boolean; fitMode: "stretch" | "preserve" | "exact" }) => void;
}

export function ImageUploader({ onImagesChange, processingOptions, onOptionsChange }: ImageUploaderProps) {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const processFiles = useCallback((files: FileList) => {
    const newImages: ImageFile[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const id = Math.random().toString(36).substr(2, 9);
        const preview = URL.createObjectURL(file);
        
        newImages.push({
          id,
          file,
          preview,
          name: file.name,
          size: formatFileSize(file.size)
        });
      }
    });

    const updatedImages = [...images, ...newImages];
    setImages(updatedImages);
    onImagesChange(updatedImages);
  }, [images, onImagesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const removeImage = (id: string) => {
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card
        className={`border-2 border-dashed transition-all duration-200 ${
          isDragging 
            ? "border-primary bg-primary/5 scale-[1.02]" 
            : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Upload Your Design Files</h3>
          <p className="text-muted-foreground mb-4 max-w-sm">
            Drag and drop your images here, or click to browse. PNG, JPG, SVG supported.
          </p>
          <label htmlFor="file-upload">
            <Button variant="outline" className="cursor-pointer" asChild>
              <span>Choose Files</span>
            </Button>
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>

      {/* Processing Options */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center space-x-2 mb-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="upscale"
                checked={processingOptions.upscale}
                onCheckedChange={(checked) => 
                  onOptionsChange({ ...processingOptions, upscale: !!checked })
                }
              />
              <Label htmlFor="upscale" className="flex items-center space-x-2">
                <Zap className="h-4 w-4 text-primary" />
                <span>Upscale Images to High Resolution + 300 DPI</span>
              </Label>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Image Fitting Options</Label>
            <RadioGroup 
              value={processingOptions.fitMode} 
              onValueChange={(value: "stretch" | "preserve" | "exact") => 
                onOptionsChange({ ...processingOptions, fitMode: value })
              }
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="stretch" id="stretch" />
                <Label htmlFor="stretch">Stretch Images To Fit Print Area(s)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="preserve" id="preserve" />
                <Label htmlFor="preserve">Preserve Image Aspect Ratios & Center</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="exact" id="exact" />
                <Label htmlFor="exact">Exactly Match Example Image(s)</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Uploaded Images */}
      {images.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Uploaded Images</h3>
              <Badge variant="secondary">{images.length} files</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image) => (
                <div key={image.id} className="group relative">
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-0">
                      <div className="aspect-square relative">
                        <img
                          src={image.preview}
                          alt={image.name}
                          className="w-full h-full object-cover"
                        />
                        <Button
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(image.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-medium truncate" title={image.name}>
                          {image.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{image.size}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}