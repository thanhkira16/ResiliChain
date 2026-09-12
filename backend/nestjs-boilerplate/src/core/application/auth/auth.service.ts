import { Injectable, Inject } from "@nestjs/common";
import type { IUserRepository } from "../../domain/user/interface/user.repository.interface";
import type { IAuthRepository } from "../../domain/auth/interface/auth.repository.interface";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { LoginUserDto, CreateUserDto } from "./dto";
import { RegisterResponse } from "./response/register.response";
import { 
    UserAlreadyExistsException, 
    UserNotFoundException, 
    InvalidCredentialsException,
    InvalidTokenException,
    ERROR_MESSAGES,
    USER_REPOSITORY_TOKEN,
    AUTH_REPOSITORY_TOKEN
} from "../../common";

@Injectable()
export class AuthService {
    constructor(
        @Inject(USER_REPOSITORY_TOKEN) 
        private readonly userRepository: IUserRepository,
        @Inject(AUTH_REPOSITORY_TOKEN) 
        private readonly authRepository: IAuthRepository,
        private readonly passwordService: PasswordService,
        private readonly tokenService: TokenService,
    ) {}

    async registerUser(createUserDto: CreateUserDto): Promise<RegisterResponse> {
        const existingUser = await this.userRepository.findByEmail(createUserDto.email);
        if (existingUser) {
            throw new UserAlreadyExistsException(ERROR_MESSAGES.USER_ALREADY_EXISTS);
        }
        
        const hashedPassword = await this.passwordService.hashPassword(createUserDto.password);
        
        const userWithHashedPassword = {
            ...createUserDto,
            password: hashedPassword,
        };

        const user = await this.userRepository.createOne(userWithHashedPassword);
        return {
            id: user.id,
            email: user.email,
            full_name: user.username,
        };
    }

    async login(loginDto: LoginUserDto) {
        const user = await this.validateAndGetUser(loginDto);
        
        const tokens = this.tokenService.generateTokens({
            email: user.email, 
            userId: user.id,
            role: user.role
        });
        await this.storeRefreshToken(tokens.refreshToken, user.id);
                
        return {
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
        };
    }

    async findOrCreateGoogleUser(googleUser: { googleId: string; email: string; username: string }) {
        let user = await this.userRepository.findByGoogleId(googleUser.googleId);
        
        if (!user) {
        user = await this.userRepository.findByEmail(googleUser.email);
        
            if (user) {
                user.googleId = googleUser.googleId;
                await this.userRepository.updateById(user.id, { googleId: googleUser.googleId });
            } else {
                user = await this.userRepository.createOne({
                email: googleUser.email,
                username: googleUser.username,
                googleId: googleUser.googleId,
                role: 'user',
                });
            }
        }
        
        return user;
    }

    async loginWithGoogle(user: any) {
        const tokens = this.tokenService.generateTokens({
        email: user.email,
        userId: user.id,
        role: user.role,
        });
        
        await this.storeRefreshToken(tokens.refreshToken, user.id);
        
        return {
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        };
    }

    private async validateAndGetUser(loginDto: LoginUserDto) {
        const user = await this.userRepository.findByEmail(loginDto.email);
        
        if (!user) {
            throw new UserNotFoundException(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        if (user.password == null) {
            throw new InvalidCredentialsException(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        const isPasswordValid = await this.passwordService.comparePassword(
            loginDto.password, 
            user.password
        );
        
        if (!isPasswordValid) {
            throw new InvalidCredentialsException(ERROR_MESSAGES.INVALID_CREDENTIALS);
        }

        return user;
    }

    private async storeRefreshToken(refreshToken: string, userId: number) {
        await this.authRepository.createRefreshToken(refreshToken, userId);
    }

    async refreshToken(refreshToken: string) {
        try {
            const payload = this.tokenService.verifyToken(refreshToken);
            
            const newAccessToken = this.tokenService.generateAccessToken({
                email: payload.email,
                userId: payload.userId,
                role: payload.role
            });

            return {
                access_token: newAccessToken
            };
        } catch (error) {
            throw new InvalidTokenException(ERROR_MESSAGES.INVALID_TOKEN);
        }
    }
}