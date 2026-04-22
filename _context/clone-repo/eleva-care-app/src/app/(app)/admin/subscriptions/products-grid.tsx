'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, Plus } from 'lucide-react';
import { useState } from 'react';
import type Stripe from 'stripe';

import { CreatePriceModal } from './create-price-modal';
import { PricesTable } from './prices-table';

interface ProductsGridProps {
  products: Stripe.Product[];
}

export function ProductsGrid({ products }: ProductsGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Stripe.Product | null>(null);
  const [createPriceModalOpen, setCreatePriceModalOpen] = useState(false);

  const handleCreatePrice = (product: Stripe.Product) => {
    setSelectedProduct(product);
    setCreatePriceModalOpen(true);
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Package className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No Products Found</h3>
          <p className="text-sm text-muted-foreground">
            No active Stripe products found. Create products in your Stripe Dashboard.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-6">
        {products.map((product) => (
          <Card key={product.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {product.name}
                    {product.active ? (
                      <Badge variant="default" className="ml-2">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Archived</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="mt-2">
                    {product.description || 'No description'}
                  </CardDescription>
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Product ID: {product.id}</span>
                  </div>
                </div>
                <Button onClick={() => handleCreatePrice(product)} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Price
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <PricesTable productId={product.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedProduct && (
        <CreatePriceModal
          open={createPriceModalOpen}
          onOpenChange={setCreatePriceModalOpen}
          product={selectedProduct}
        />
      )}
    </>
  );
}
