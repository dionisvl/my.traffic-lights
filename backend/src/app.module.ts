import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { GameController } from './game.controller';
import { HealthController } from './health.controller';
import { QuestionsController } from './questions.controller';

@Module({
  controllers: [GameController, QuestionsController, HealthController],
  providers: [GameGateway],
})
export class AppModule {}
