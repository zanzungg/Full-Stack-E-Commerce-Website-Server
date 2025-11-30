import ProductModel from '../models/product.model.js';

/**
 * Build filter object từ query parameters
 */
export async function buildProductFilter(baseFilter, queryParams) {
  const {
      minPrice, maxPrice, brand, rating, 
      inStock, discount, productRam, size, productWeight, location
  } = queryParams;
  
  const filter = { ...baseFilter };
  
  // Price range
  if (minPrice || maxPrice) {
    filter.price = {};
    
    const minPriceNum = minPrice ? parseFloat(minPrice) : null;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;

    // Validate min <= max
    if (minPriceNum && maxPriceNum && minPriceNum > maxPriceNum) {
      console.warn('Min price cannot be greater than max price');
      // Swap values
      filter.price.$gte = maxPriceNum;
      filter.price.$lte = minPriceNum;
    } else {
        if (minPriceNum >= 0) filter.price.$gte = minPriceNum;
        if (maxPriceNum >= 0) filter.price.$lte = maxPriceNum;
    }
  }
  
  // Brand
  if (brand) {
      filter.brand = { $regex: brand.trim(), $options: 'i' };
  }
  
  // Rating
  if (rating) {
      const ratingNum = parseFloat(rating);
      if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= 5) {
          filter.rating = { $gte: ratingNum };
      }
  }
  
  // Stock
  if (inStock !== undefined) {
      filter.countInStock = inStock === 'true' ? { $gt: 0 } : 0;
  }
  
  // Discount
  if (discount) {
      const discountNum = parseFloat(discount);
      if (!isNaN(discountNum) && discountNum >= 0) {
          filter.discount = { $gte: discountNum };
      }
  }
  
  // Arrays - Product RAM
  if (productRam) {
      const ramArray = productRam.split(',').map(r => r.trim()).filter(Boolean);
      if (ramArray.length > 0) {
          filter.productRam = { $in: ramArray };
      }
  }
  
  // Arrays - Size
  if (size) {
      const sizeArray = size.split(',').map(s => s.trim()).filter(Boolean);
      if (sizeArray.length > 0) {
          filter.size = { $in: sizeArray };
      }
  }
  
  // Arrays - Product Weight
  if (productWeight) {
      const weightArray = productWeight.split(',').map(w => w.trim()).filter(Boolean);
      if (weightArray.length > 0) {
          filter.productWeight = { $in: weightArray };
      }
  }
  
  // Location (nested object)
  if (location) {
      filter['location.value'] = { $regex: location.trim(), $options: 'i' };
  }
  
  return filter;
}

/**
 * Build sort object từ sort parameter
 */
export function buildSortObject(sortParam = '-createdAt') {
  // Validate input type
  if (typeof sortParam !== 'string') {
      console.warn('Invalid sort parameter type, using default');
      return { createdAt: -1 };
  }

  const sortObj = {};
  
  // Allowed sort fields (whitelist)
  const allowedFields = [
      'name', 'price', 'rating', 'createdAt', 
      'discount', 'countInStock', 'brand'
  ];
  
  sortParam.split(',').forEach(field => {
      const trimmedField = field.trim();
      if (!trimmedField) return;
      
      const fieldName = trimmedField.startsWith('-') 
          ? trimmedField.substring(1) 
          : trimmedField;
      
      // Only allow whitelisted fields
      if (!allowedFields.includes(fieldName)) {
          console.warn(`Invalid sort field: ${fieldName}`);
          return;
      }
      
      sortObj[fieldName] = trimmedField.startsWith('-') ? -1 : 1;
  });
  
  if (Object.keys(sortObj).length === 0) {
      sortObj.createdAt = -1;
  }
  
  return sortObj;
}

/**
 * Get available filters cho frontend (brands, price range, etc.)
 */
export async function getAvailableFilters(matchFilter) {
  try {
    const [brands, priceRange, ramOptions, sizeOptions, weightOptions] = await Promise.all([
        // Brands
        ProductModel.distinct('brand', { 
            ...matchFilter, 
            brand: { $ne: '', $exists: true } 
        }),
        
        // Price range
        ProductModel.aggregate([
            { $match: matchFilter },
            { 
                $group: { 
                    _id: null, 
                    minPrice: { $min: '$price' }, 
                    maxPrice: { $max: '$price' } 
                } 
            }
        ]),
        
        // RAM options
        ProductModel.distinct('productRam', matchFilter),
        
        // Size options
        ProductModel.distinct('size', matchFilter),
        
        // Weight options
        ProductModel.distinct('productWeight', matchFilter)
    ]);
    
    return {
        brands: brands.filter(Boolean).sort(),
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0 },
        ramOptions: ramOptions.flat().filter(Boolean).sort(),
        sizeOptions: sizeOptions.flat().filter(Boolean).sort(),
        weightOptions: weightOptions.flat().filter(Boolean).sort()
    };
  } catch (error) {
    console.error('Get Available Filters Error:', error);
    return {
        brands: [],
        priceRange: { minPrice: 0, maxPrice: 0 },
        ramOptions: [],
        sizeOptions: [],
        weightOptions: []
    };
  }
}

/**
 * Validate và parse pagination parameters
 */
export function validatePaginationParams(page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  
  const errors = [];
  
  if (isNaN(pageNum) || pageNum < 1) {
      errors.push('Page must be a positive integer');
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      errors.push('Limit must be between 1 and 100');
  }
  
  return {
      pageNum: Math.max(1, pageNum),
      limitNum: Math.max(1, Math.min(100, limitNum)),
      errors
  };
}

/**
 * Build pagination metadata
 */
export function buildPaginationMetadata(pageNum, limitNum, totalProducts) {
  const totalPages = Math.ceil(totalProducts / limitNum);
  
  return {
      currentPage: pageNum,
      totalPages,
      totalProducts,
      limit: limitNum,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      prevPage: pageNum > 1 ? pageNum - 1 : null
  };
}

/**
 * Fetch products với pagination
 */
export async function fetchProducts(filter, sortObj, pageNum, limitNum) {
  const skip = (pageNum - 1) * limitNum;
  
  const [totalProducts, products] = await Promise.all([
      ProductModel.countDocuments(filter),
      ProductModel
          .find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate('category', 'name slug color')
          .select('-__v')
          .lean()
  ]);
  
  return { totalProducts, products };
}

/**
 * Build applied filters response object
 */
export function buildAppliedFilters(queryParams, extraFilters = {}) {
  return {
      ...extraFilters,
      brand: queryParams.brand || null,
      priceRange: queryParams.minPrice || queryParams.maxPrice 
          ? { min: queryParams.minPrice, max: queryParams.maxPrice } 
          : null,
      rating: queryParams.rating || null,
      inStock: queryParams.inStock !== undefined ? queryParams.inStock : null,
      discount: queryParams.discount || null,
      productRam: queryParams.productRam || null,
      size: queryParams.size || null,
      productWeight: queryParams.productWeight || null,
      location: queryParams.location || null
  };
}

/**
 * Generic handler để get products theo field
 */
export async function getProductsByField(fieldName, fieldValue, queryParams, options = {}) {
  try {
    // Validate pagination
    const { pageNum, limitNum, errors } = validatePaginationParams(
        queryParams.page,
        queryParams.limit
    );

    if (errors.length > 0) {
        return {
            success: false,
            statusCode: 400,
            data: { 
                message: errors.join(', '), 
                error: true, 
                success: false 
            }
        };
    }

    // Build base filter
    let baseFilter;
    
    if (options.useRegex) {
        // For name-based fields (catName, subCat, thirdSubCat)
        baseFilter = { 
            [fieldName]: { 
                $regex: options.exactMatch ? `^${fieldValue}$` : fieldValue, 
                $options: 'i' 
            } 
        };
    } else {
        // For ID-based fields (catId, subCatId, thirdSubCatId)
        baseFilter = { [fieldName]: fieldValue };
    }

    // Build full filter với query parameters
    const filter = await buildProductFilter(baseFilter, queryParams);
    
    // Build sort object
    const sortObj = buildSortObject(queryParams.sort);

    // Fetch products
    const { totalProducts, products } = await fetchProducts(
        filter,
        sortObj,
        pageNum,
        limitNum
    );

    // Check if no products found
    if (totalProducts === 0 && pageNum === 1) {
        return {
            success: false,
            statusCode: 404,
            data: {
                message: `No products found for ${fieldName}: ${fieldValue}`,
                error: true,
                success: false
            }
        };
    }

    // Get available filters
    const availableFilters = await getAvailableFilters(baseFilter);
    
    // Build pagination metadata
    const pagination = buildPaginationMetadata(pageNum, limitNum, totalProducts);

    // Build applied filters
    const appliedFilters = buildAppliedFilters(queryParams, {
        [fieldName]: fieldValue
    });

    return {
        success: true,
        statusCode: 200,
        data: {
            message: 'Products retrieved successfully',
            error: false,
            success: true,
            data: products,
            pagination,
            appliedFilters,
            availableFilters
        }
    };
  } catch (error) {
    console.error(`Get Products By ${fieldName} Error:`, error);
    return {
        success: false,
        statusCode: 500,
        data: {
            message: error.message || 'Failed to retrieve products',
            error: true,
            success: false
        }
    };
  }
}

/**
 * Get third subcategories under a specific filter
 */
export async function getThirdSubCategories(matchFilter) {
  try {
      return await ProductModel.distinct('thirdSubCat', { 
          ...matchFilter,
          thirdSubCat: { $ne: '', $exists: true }
      });
  } catch (error) {
      console.error('Get Third Sub Categories Error:', error);
      return [];
  }
}