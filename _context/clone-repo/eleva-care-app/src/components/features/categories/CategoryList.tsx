'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Edit, ImageIcon, Plus, Trash2, X } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type Category = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ImageUploadResponse = {
  url: string;
  success: boolean;
};

export function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Load categories on mount
  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch('/api/admin/categories');
        if (!response.ok) throw new Error('Failed to load categories');
        const { success, data, error } = await response.json();

        if (!success) {
          throw new Error(error || 'Failed to load categories');
        }

        // Ensure we have an array of categories
        const categoriesArray = Array.isArray(data) ? data : [];
        setCategories(categoriesArray);
      } catch (error) {
        console.error('Error loading categories:', error);
        toast.error('Failed to load categories');
        // Set empty array on error to prevent filter issues
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadCategories();
  }, []);

  const mainCategories = categories.filter((cat) => !cat.parentId);
  const getSubcategories = (parentId: string) =>
    categories.filter((cat) => cat.parentId === parentId);

  const handleImageUpload = async (file: File): Promise<ImageUploadResponse> => {
    try {
      if (file.size > 4.5 * 1024 * 1024) {
        toast.error('Image must be less than 4.5MB', {
          description: 'Please choose a smaller image file.',
        });
        return { url: '', success: false };
      }

      const filename = `${Date.now()}-${file.name}`;
      const response = await fetch(
        `/api/upload?filename=${encodeURIComponent(filename)}&folder=categories`,
        {
          method: 'POST',
          body: file,
        },
      );

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }

      return { url: data.url, success: true };
    } catch (error) {
      console.error('Error uploading image:', error);
      return { url: '', success: false };
    }
  };

  const handleDeleteImage = async (imageUrl: string) => {
    try {
      const response = await fetch(`/api/upload?url=${encodeURIComponent(imageUrl)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete old image');
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    const { url, success } = await handleImageUpload(file);
    setIsUploading(false);

    if (success && url) {
      const imageInput = document.querySelector(`input[name="image"]`) as HTMLInputElement;
      if (imageInput) {
        imageInput.value = url;
      }
    } else {
      toast.error('Failed to upload image');
      setImagePreview(null);
      const imageInput = document.querySelector(`input[name="image"]`) as HTMLInputElement;
      if (imageInput) {
        imageInput.value = '';
      }
    }
  };

  const handleAddCategory = async (formData: FormData) => {
    try {
      // Get the image URL from the hidden input
      const imageUrl = formData.get('image') as string;

      // Only include image in formData if we have a URL
      if (!imageUrl) {
        formData.delete('image');
      }

      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to add category');
      }

      const newCategory = await response.json();
      setCategories([...categories, newCategory]);
      setIsAddDialogOpen(false);
      setImagePreview(null);
      toast.success('Category added successfully');
    } catch (error) {
      console.error('Error adding category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add category');
    }
  };

  const handleEditCategory = async (id: string, formData: FormData) => {
    try {
      const oldCategory = categories.find((cat) => cat.id === id);

      // Get the image URL from the hidden input
      const imageUrl = formData.get('image') as string;

      // Only include image in formData if we have a URL or if we're removing the image
      if (!imageUrl) {
        formData.delete('image');
      }

      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          // Do not set Content-Type here, it will be automatically set with the correct boundary for FormData
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to update category');
      }

      const updatedCategory = await response.json();
      setCategories(categories.map((cat) => (cat.id === id ? updatedCategory : cat)));

      // Delete old image if it exists and has changed
      if (
        oldCategory?.image &&
        oldCategory.image !== imageUrl &&
        oldCategory.image.includes('public.blob.vercel-storage.com')
      ) {
        await handleDeleteImage(oldCategory.image);
      }

      toast.success('Category updated successfully');
    } catch (error) {
      console.error('Error updating category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update category');
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const category = categories.find((cat) => cat.id === id);

      const response = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to delete category');
      }

      setCategories(categories.filter((cat) => cat.id !== id));

      // Delete image if it exists
      if (category?.image?.includes('public.blob.vercel-storage.com')) {
        await handleDeleteImage(category.image);
      }

      toast.success('Category deleted successfully');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete category');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button disabled>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        </div>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="h-20" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
            </DialogHeader>
            <form action={handleAddCategory} className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" />
              </div>
              <div>
                <Label htmlFor="image">Image</Label>
                <div className="space-y-2">
                  <Input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  <Input id="image" name="image" type="url" className="hidden" />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('imageUpload')?.click()}
                      disabled={isUploading}
                    >
                      <ImageIcon className="mr-2 h-4 w-4" />
                      {isUploading ? 'Uploading...' : 'Upload Image'}
                    </Button>
                    {imagePreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          setImagePreview(null);
                          const imageInput = document.querySelector(
                            'input[name="image"]',
                          ) as HTMLInputElement;
                          if (imageInput) {
                            imageInput.value = '';
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {imagePreview && (
                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="parentId">Parent Category</Label>
                <Select name="parentId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a parent category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">None (Main Category)</SelectItem>
                    {mainCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit">Add Category</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {mainCategories.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>No Categories</CardTitle>
            <CardDescription>Start by adding your first category</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        mainCategories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            subcategories={getSubcategories(category.id)}
            onEdit={handleEditCategory}
            onDelete={handleDeleteCategory}
          />
        ))
      )}
    </div>
  );
}

function CategoryCard({
  category,
  subcategories,
  onEdit,
  onDelete,
}: {
  category: Category;
  subcategories: Category[];
  onEdit: (id: string, formData: FormData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(category.image);
  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (file: File): Promise<ImageUploadResponse> => {
    try {
      if (file.size > 4.5 * 1024 * 1024) {
        toast.error('Image must be less than 4.5MB', {
          description: 'Please choose a smaller image file.',
        });
        return { url: '', success: false };
      }

      const filename = `${Date.now()}-${file.name}`;
      const response = await fetch(
        `/api/upload?filename=${encodeURIComponent(filename)}&folder=categories`,
        {
          method: 'POST',
          body: file,
        },
      );

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }

      return { url: data.url, success: true };
    } catch (error) {
      console.error('Error uploading image:', error);
      return { url: '', success: false };
    }
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsUploading(true);
    const { url, success } = await handleImageUpload(file);
    setIsUploading(false);

    if (success && url) {
      const imageInput = document.querySelector(`input[name="image"]`) as HTMLInputElement;
      if (imageInput) {
        imageInput.value = url;
      }
    } else {
      toast.error('Failed to upload image');
      setImagePreview(category.image);
      const imageInput = document.querySelector(`input[name="image"]`) as HTMLInputElement;
      if (imageInput) {
        imageInput.value = category.image || '';
      }
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
        <div className="flex items-center gap-1">
          {subcategories.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          )}
          <div className="flex items-center gap-2">
            {category.image && (
              <div className="relative h-8 w-8 overflow-hidden rounded-full">
                <Image src={category.image} alt={category.name} fill className="object-cover" />
              </div>
            )}
            <div>
              <CardTitle className="text-base">{category.name}</CardTitle>
              {category.description && (
                <CardDescription className="text-xs">{category.description}</CardDescription>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Edit className="h-3 w-3" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Category</DialogTitle>
              </DialogHeader>
              <form
                action={(formData) => {
                  onEdit(category.id, formData);
                  setIsEditDialogOpen(false);
                }}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor={`name-${category.id}`}>Name</Label>
                  <Input
                    id={`name-${category.id}`}
                    name="name"
                    defaultValue={category.name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor={`description-${category.id}`}>Description</Label>
                  <Textarea
                    id={`description-${category.id}`}
                    name="description"
                    defaultValue={category.description || ''}
                  />
                </div>
                <div>
                  <Label htmlFor={`image-${category.id}`}>Image</Label>
                  <div className="space-y-2">
                    <Input
                      id={`imageUpload-${category.id}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageChange}
                    />
                    <Input
                      id={`image-${category.id}`}
                      name="image"
                      type="url"
                      className="hidden"
                      defaultValue={category.image || ''}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document.getElementById(`imageUpload-${category.id}`)?.click()
                        }
                        disabled={isUploading}
                      >
                        <ImageIcon className="mr-2 h-4 w-4" />
                        {isUploading ? 'Uploading...' : 'Upload Image'}
                      </Button>
                      {imagePreview && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setImagePreview(null);
                            const imageInput = document.querySelector(
                              `input[name="image"]`,
                            ) as HTMLInputElement;
                            if (imageInput) {
                              imageInput.value = '';
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {imagePreview && (
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                        <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                      </div>
                    )}
                  </div>
                </div>
                <Button type="submit">Update Category</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onDelete(category.id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      {subcategories.length > 0 && (
        <CardContent className={cn('py-0 pl-6', !isExpanded && 'hidden')}>
          <div className="space-y-1 border-l pl-2">
            {subcategories.map((subcategory) => (
              <CategoryCard
                key={subcategory.id}
                category={subcategory}
                subcategories={[]}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
