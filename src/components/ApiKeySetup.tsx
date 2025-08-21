import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ApiKeySetupProps {
  onKeysSet: (youtubeKey: string, geminiKey: string) => void;
}

export const ApiKeySetup = ({ onKeysSet }: ApiKeySetupProps) => {
  const [youtubeKey, setYoutubeKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!youtubeKey.trim() || !geminiKey.trim()) {
      toast({
        title: "Missing API Keys",
        description: "Please enter both YouTube and Gemini API keys.",
        variant: "destructive",
      });
      return;
    }

    // Store in localStorage
    localStorage.setItem("youtube_api_key", youtubeKey.trim());
    localStorage.setItem("gemini_api_key", geminiKey.trim());
    
    onKeysSet(youtubeKey.trim(), geminiKey.trim());
    
    toast({
      title: "API Keys Saved",
      description: "Your API keys have been securely stored locally.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">PrivateTube Setup</CardTitle>
          <CardDescription>
            Enter your API keys to get started. These will be stored securely on your device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="youtube-key">YouTube Data API v3 Key</Label>
              <Input
                id="youtube-key"
                type="password"
                placeholder="Enter your YouTube API key"
                value={youtubeKey}
                onChange={(e) => setYoutubeKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="Enter your Gemini API key"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Save API Keys
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};