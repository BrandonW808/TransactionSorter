import { UserModel } from '../models/User.model';
import { CreateUserRequest, UpdateUserRequest, IUserDocument } from '../types';
import { Types } from 'mongoose';

export async function createUser(userData: CreateUserRequest): Promise<IUserDocument> {
  try {
    const existingUser = await UserModel.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const user = new UserModel(userData);
    await user.save();
    return user;
  } catch (error) {
    if (error instanceof Error && error.message.includes('duplicate key')) {
      throw new Error('User with this email already exists');
    }
    throw error;
  }
}

export async function getAllUsers(): Promise<IUserDocument[]> {
  return UserModel.find({}).sort({ createdAt: -1 });
}

export async function getUserById(id: string): Promise<IUserDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }
  return UserModel.findById(id);
}

export async function searchUsers(query: string): Promise<IUserDocument[]> {
  const searchRegex = new RegExp(query, 'i');
  return UserModel.find({
    $or: [
      { name: searchRegex },
      { email: searchRegex }
    ]
  }).sort({ name: 1 });
}

export async function updateUser(id: string, updateData: UpdateUserRequest): Promise<IUserDocument | null> {
  if (!Types.ObjectId.isValid(id)) {
    return null;
  }

  // Check if email is being updated and if it already exists
  if (updateData.email) {
    const existingUser = await UserModel.findOne({
      email: updateData.email,
      _id: { $ne: new Types.ObjectId(id) }
    });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
  }

  const user = await UserModel.findByIdAndUpdate(
    id,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return user;
}

export async function deleteUser(id: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(id)) {
    return false;
  }

  const result = await UserModel.findByIdAndDelete(id);
  return result !== null;
}
