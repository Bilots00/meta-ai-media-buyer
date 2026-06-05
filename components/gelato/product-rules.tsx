import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Sparkles, FileText, Tag, Wand2, Save } from "lucide-react";

interface ProductRules {
  titleMode: "filename" | "ai-simple" | "ai-compound";
  titleMaxWords: number;
  titleCustomText: string;
  descriptionMode: "copy" | "ai";
  descriptionParagraphs: number;
  descriptionSentences: number;
  descriptionCustomHTML: string;
  tagsMode: "copy" | "ai";
  tagsMaxCount: number;
  tagsCustom: string[];
  includeCustomTitle: boolean;
  includeCustomDescription: boolean;
}

interface ProductRulesProps {
  rules: ProductRules;
  onRulesChange: (rules: ProductRules) => void;
  onSave: () => void;
}

export function ProductRules({ rules, onRulesChange, onSave }: ProductRulesProps) {
  const [newTag, setNewTag] = useState("");

  const updateRules = (updates: Partial<ProductRules>) => {
    onRulesChange({ ...rules, ...updates });
  };

  const addCustomTag = () => {
    if (newTag.trim() && !rules.tagsCustom.includes(newTag.trim())) {
      updateRules({
        tagsCustom: [...rules.tagsCustom, newTag.trim()]
      });
      setNewTag("");
    }
  };

  const removeCustomTag = (tag: string) => {
    updateRules({
      tagsCustom: rules.tagsCustom.filter(t => t !== tag)
    });
  };

  return (
    <div className="space-y-6">
      {/* Product Titles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Product Titles</span>
          </CardTitle>
          <CardDescription>
            Configure how product titles will be generated
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup 
            value={rules.titleMode} 
            onValueChange={(value: "filename" | "ai-simple" | "ai-compound") => 
              updateRules({ titleMode: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="filename" id="filename" />
              <Label htmlFor="filename">Use Image Filenames</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai-simple" id="ai-simple" />
              <Label htmlFor="ai-simple" className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Simple AI Title</span>
              </Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai-compound" id="ai-compound" />
              <Label htmlFor="ai-compound" className="flex items-center space-x-2">
                <Wand2 className="h-4 w-4 text-primary" />
                <span>Compound AI Title</span>
              </Label>
            </div>
          </RadioGroup>

          {rules.titleMode.startsWith('ai') && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="space-y-2">
                <Label>Max Words Per Title: {rules.titleMaxWords}</Label>
                <Slider
                  value={[rules.titleMaxWords]}
                  onValueChange={(value) => updateRules({ titleMaxWords: value[0] })}
                  max={15}
                  min={3}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="customTitle"
                  checked={rules.includeCustomTitle}
                  onCheckedChange={(checked) => 
                    updateRules({ includeCustomTitle: !!checked })
                  }
                />
                <Label htmlFor="customTitle">Include Custom Text In Each Title</Label>
              </div>
              
              {rules.includeCustomTitle && (
                <Input
                  placeholder="e.g., — Canvas Wall Art"
                  value={rules.titleCustomText}
                  onChange={(e) => updateRules({ titleCustomText: e.target.value })}
                />
              )}

              <div className="text-sm text-muted-foreground p-3 bg-background rounded border">
                <strong>Example Title:</strong><br />
                {rules.titleMode === 'ai-simple' 
                  ? `"The Feathered Gentleman${rules.includeCustomTitle ? ` ${rules.titleCustomText}` : ''}"` 
                  : `"The Feathered Gentleman: Classy Bird Portrait, Funny Animal Art${rules.includeCustomTitle ? ` ${rules.titleCustomText}` : ''}"`
                }
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Product Descriptions</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup 
            value={rules.descriptionMode} 
            onValueChange={(value: "copy" | "ai") => 
              updateRules({ descriptionMode: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="copy" id="copy-desc" />
              <Label htmlFor="copy-desc">Copy From Example Product</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai" id="ai-desc" />
              <Label htmlFor="ai-desc" className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Generate Using AI</span>
              </Label>
            </div>
          </RadioGroup>

          {rules.descriptionMode === 'ai' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Paragraphs: {rules.descriptionParagraphs}</Label>
                  <Slider
                    value={[rules.descriptionParagraphs]}
                    onValueChange={(value) => updateRules({ descriptionParagraphs: value[0] })}
                    max={5}
                    min={1}
                    step={1}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Sentences per Paragraph: {rules.descriptionSentences}</Label>
                  <Slider
                    value={[rules.descriptionSentences]}
                    onValueChange={(value) => updateRules({ descriptionSentences: value[0] })}
                    max={6}
                    min={2}
                    step={1}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Checkbox
              id="customDesc"
              checked={rules.includeCustomDescription}
              onCheckedChange={(checked) => 
                updateRules({ includeCustomDescription: !!checked })
              }
            />
            <Label htmlFor="customDesc">Include Custom HTML In Each Description</Label>
          </div>
          
          {rules.includeCustomDescription && (
            <Textarea
              placeholder="e.g., <p>High-quality print on premium materials.</p>"
              value={rules.descriptionCustomHTML}
              onChange={(e) => updateRules({ descriptionCustomHTML: e.target.value })}
              rows={3}
            />
          )}
        </CardContent>
      </Card>

      {/* Product Tags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Tag className="h-5 w-5" />
            <span>Product Tags</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup 
            value={rules.tagsMode} 
            onValueChange={(value: "copy" | "ai") => 
              updateRules({ tagsMode: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="copy" id="copy-tags" />
              <Label htmlFor="copy-tags">Copy From Example Product</Label>
            </div>
            
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="ai" id="ai-tags" />
              <Label htmlFor="ai-tags" className="flex items-center space-x-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Generate Using AI</span>
              </Label>
            </div>
          </RadioGroup>

          {rules.tagsMode === 'ai' && (
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              <Label>Max AI Generated Tags: {rules.tagsMaxCount}</Label>
              <Slider
                value={[rules.tagsMaxCount]}
                onValueChange={(value) => updateRules({ tagsMaxCount: value[0] })}
                max={20}
                min={5}
                step={1}
              />
            </div>
          )}

          <div className="space-y-4">
            <Label>Additional Custom Tags</Label>
            <div className="flex space-x-2">
              <Input
                placeholder="Add custom tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addCustomTag()}
              />
              <Button onClick={addCustomTag} variant="outline">
                Add
              </Button>
            </div>
            
            {rules.tagsCustom.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rules.tagsCustom.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => removeCustomTag(tag)}
                  >
                    {tag} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Card>
        <CardContent className="p-6">
          <Button 
            onClick={onSave}
            className="w-full bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--primary-glow))] hover:opacity-90"
            size="lg"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Current Operation
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}