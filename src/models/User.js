const mongoose=require('mongoose');

const userSchema= new mongoose.Schema(
    {
        name:{
            type:String,
            required:[true,'Name is Required'],
            trim:true,
        },
        email:{
            type:String,
            required:[true,'Email is Required'],
            unique:true,
            lowercase:true,
            trim:true,
        },
        password:{
            type:String,
            required:[true,'Password is required'],
        },
        role:{
            type:String,
            required:[true,'Role is required'],
            enum:['donor','ngo','admin'],
            default:'donor',
        },
        isVerified:{
            type:Boolean,
            required:true,
            default:false,
        },
        emailOTP:{
            type:String,
            default:null,
        },
        otpExpiresAt:{
            type:Date,
            default:null,
        },
        location:{
            type:{
                type:String,
                enum:['Point'],
                default:'Point',
            },
            coordinates:{
                type:[Number],
                required:false,
            },
        },
        refreshToken:{
            type:String,
            default:null,
        },
        
    },
    {
        timestamps:true,
    }
);

userSchema.index({email:1});

module.exports=mongoose.model('User',userSchema);