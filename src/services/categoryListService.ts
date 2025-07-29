import { CategoryListModel } from '../models/CategoryList.model';
import { CreateCategoryListRequest, UpdateCategoryListRequest, ICategoryListDocument } from '../types';
import { Types } from 'mongoose';

export async function createCategoryList(data: CreateCategoryListRequest): Promise<ICategoryListDocument> {
  try {
    const existingList = await CategoryListModel.findOne({ name: data.name });
    if (existingList) {
      throw new Error('Category list with this name already exists');
    }

    const categoryList = new CategoryListModel(data);
    await categoryList.save();
    return categoryList;
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new Error('Category list with this name already exists');
    }
    throw error;
  }
}

export async function getAllCategoryLists(): Promise<ICategoryListDocument[]> {
  return CategoryListModel.find({}).sort({ createdAt: -1 });
}

export async function getCategoryListById(id: string): Promise<ICategoryListDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  return CategoryListModel.findById(id);
}

export async function getDefaultCategoryList(): Promise<ICategoryListDocument | null> {
  return CategoryListModel.findOne({ isDefault: true });
}

export async function searchCategoryLists(query: string): Promise<ICategoryListDocument[]> {
  const searchRegex = new RegExp(query, 'i');
  return CategoryListModel.find({ name: searchRegex }).sort({ name: 1 });
}

export async function updateCategoryList(
  id: string,
  updateData: UpdateCategoryListRequest
): Promise<ICategoryListDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  // Check if name is being updated and if it already exists
  if (updateData.name) {
    const existingList = await CategoryListModel.findOne({
      name: updateData.name,
      _id: { $ne: new Types.ObjectId(id) }
    });
    if (existingList) {
      throw new Error('Category list with this name already exists');
    }
  }

  // If setting as default, unset other defaults (handled by pre-save hook)
  const categoryList = await CategoryListModel.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return categoryList;
}

export async function setDefaultCategoryList(id: string): Promise<ICategoryListDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  // Unset all current defaults
  await CategoryListModel.updateMany(
    { isDefault: true },
    { $set: { isDefault: false } }
  );

  // Set the new default
  return CategoryListModel.findByIdAndUpdate(
    id,
    { $set: { isDefault: true } },
    { new: true }
  );
}

export async function deleteCategoryList(id: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(id)) {
    return false;
  }

  const result = await CategoryListModel.findByIdAndDelete(id);
  return result !== null;
}

export async function ensureDefaultCategoryList(): Promise<void> {
  const defaultList = await getDefaultCategoryList();
  if (!defaultList) {
    const anyList = await CategoryListModel.findOne();
    if (anyList) {
      await setDefaultCategoryList(anyList._id.toString());
    }
  }
}

export async function initializeDefaultCategories(): Promise<void> {
  const defaultList = await getDefaultCategoryList();
  if (!defaultList) {
    const defaultCategories = {
      Income: {
        Kinect: ["dataannotation", "kinect"],
        Other: ["e-transfer", "deposit", "income"]
      },
      Expenses: {
        "Living Expenses": ["rent", "hydro", "utility", "insurance", "bill", "property tax"],
        "Groceries": ["walmart", "superstore", "loblaws", "costco", "iga", "super c", "the village store", "freshmarket", "athens fresh market"],
        "Pets": ["vet", "petco", "petland"],
        "Subscriptions": ["spotify", "netflix", "crave", "subscription", "prime", "virgin plus", "disney", "github"],
        "Phone Bill": ["rogers", "bell", "fido", "koodo", "phone"],
        "Alcohol": ["liquor", "beer store", "lcbo", "fpos Saq"],
        "Non-Grocery Food": ["restaurant", "ubereats", "skipthe", "fast food", "mcdonalds", "tim hortons", "coffee", "couchetard", "convenien", "A & W", "Picton On vic social", "Picton On metro", "Kettleman'S"],
        "Misc Spending": ["service charge", "fee", "bank charge", "big al's aquarium", "value village", "amzn", "affirm canada", "physio outaouais", "amazon.ca", "sail",
          "kindle", " L'As Des Jeux ", "sessions cannabis", "interest charges", "justice quebec amendes", "dollarama", "cdkeys"],
        "Automotive": ["petro-canada", "esso", "shell", "gas", "car", "tire", "maintenance", "pioneer", "macewen"],
        "Gifts": [],
        "Dates": ["cinema", "famous players", "dinner", "flower", "midtown brewing", "currah's cafe", "karlo estates", "prince eddy"],
        "Loans": ["loan", "student", "repayment", "nslsc"],
        "Trips": ["airbnb", "flight", "air canada", "hotel", "expedia", "mecp-ontpark-int-resorill"],
        "Sailboat Work": ["marine", "boat", "chandlery"]
      }
    };

    await createCategoryList({
      name: 'Default Categories',
      categories: defaultCategories,
      isDefault: true
    });
  }
}
