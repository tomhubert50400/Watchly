import { Global, Module } from '@nestjs/common';
import { AvatarStorageService } from './avatar-storage.service';

@Global()
@Module({
  exports: [AvatarStorageService],
  providers: [AvatarStorageService],
})
export class MediaModule {}
